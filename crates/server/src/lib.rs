use anyhow::Result;
use axum::{
    body::Bytes,
    extract::{Path, Query, State},
    http::{HeaderMap, HeaderValue, Method, StatusCode},
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse,
    },
    routing::{any, get, post},
    Json, Router,
};
use boson_core::{
    execution::{run_route, RunResult},
    loader::load_workspace,
    schema::{
        EnvironmentConfig, PresetDefinition, ProjectConfig, RouteDefinition, RouteTest, RouteVar,
        WorkflowDefinition, WorkspaceSnapshot,
    },
};
use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{BTreeMap, VecDeque},
    convert::Infallible,
    net::SocketAddr,
    path::PathBuf,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::net::TcpListener;
use tokio::sync::{broadcast, RwLock};
use tokio_stream::{wrappers::BroadcastStream, StreamExt};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::warn;
use uuid::Uuid;

#[derive(Clone)]
pub struct AppState {
    pub root_dir: PathBuf,
    pub base_url: String,
    pub http_client: Client,
    pub workspace_events: broadcast::Sender<()>,
    run_history: Arc<RwLock<VecDeque<RunHistoryItem>>>,
    workflow_history: Arc<RwLock<VecDeque<WorkflowRunHistoryItem>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RunHistoryItem {
    run_id: String,
    route_id: String,
    route_name: String,
    method: String,
    path: String,
    environment_name: String,
    created_at_ms: u64,
    overrides: Option<RunRouteRequest>,
    result: RunResult,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct WorkflowRunHistoryItem {
    run_id: String,
    workflow_id: String,
    workflow_name: String,
    environment_name: String,
    created_at_ms: u64,
    steps: Vec<WorkflowStepResult>,
    shared_context: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct WorkflowStepResult {
    step_name: String,
    route_id: String,
    run: RunResult,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RunArtifact {
    kind: String,
    run_id: String,
    environment_name: String,
    created_at_ms: u64,
    request: Value,
    result: RunResult,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct WorkflowRunArtifact {
    kind: String,
    run_id: String,
    workflow_id: String,
    workflow_name: String,
    environment_name: String,
    created_at_ms: u64,
    steps: Vec<WorkflowStepResult>,
    shared_context: BTreeMap<String, String>,
}

#[derive(Debug, Serialize)]
struct ApiErrorBody {
    error: String,
}

pub async fn run_local_server(root_dir: PathBuf, base_url: String, addr: SocketAddr) -> Result<()> {
    let (workspace_events, _) = broadcast::channel(128);
    let _watcher = start_workspace_watcher(root_dir.join(".api"), workspace_events.clone())?;

    let state = Arc::new(AppState {
        root_dir,
        base_url,
        http_client: Client::new(),
        workspace_events,
        run_history: Arc::new(RwLock::new(VecDeque::new())),
        workflow_history: Arc::new(RwLock::new(VecDeque::new())),
    });

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/project", get(get_project))
        .route("/api/routes", get(list_routes))
        .route("/api/environments", get(list_environments))
        .route("/api/presets", get(list_presets))
        .route("/api/workflows", get(list_workflows))
        .route("/api/run/:route_id", post(run_route_handler))
        .route("/api/runs", get(list_runs).post(run_with_payload_handler))
        .route("/api/runs/:run_id", get(get_run_detail))
        .route("/api/runs/:run_id/artifact", get(get_run_artifact))
        .route("/api/runs/:run_id/re-run", post(rerun_handler))
        .route(
            "/api/workflows/:workflow_id/run",
            post(run_workflow_handler),
        )
        .route("/api/workflow-runs", get(list_workflow_runs))
        .route("/api/workflow-runs/:run_id", get(get_workflow_run_detail))
        .route(
            "/api/workflow-runs/:run_id/artifact",
            get(get_workflow_run_artifact),
        )
        .route("/api/events", get(events_handler))
        .route("/demo/rest/resource", any(rest_resource_handler))
        .route("/demo/rest/search", get(rest_search_handler))
        .route("/demo/rest/headers", get(rest_headers_handler))
        .with_state(state)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    let listener = TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

async fn health() -> impl IntoResponse {
    "ok"
}

async fn list_routes(State(state): State<Arc<AppState>>) -> Json<Vec<RouteDefinition>> {
    let snapshot = read_snapshot(&state).unwrap_or_else(|_| default_snapshot());
    Json(snapshot.routes)
}

async fn get_project(State(state): State<Arc<AppState>>) -> Json<ProjectConfig> {
    let snapshot = read_snapshot(&state).unwrap_or_else(|_| default_snapshot());
    Json(snapshot.project)
}

async fn list_environments(State(state): State<Arc<AppState>>) -> Json<Vec<EnvironmentConfig>> {
    let snapshot = read_snapshot(&state).unwrap_or_else(|_| default_snapshot());
    Json(snapshot.environments)
}

async fn list_presets(State(state): State<Arc<AppState>>) -> Json<Vec<PresetDefinition>> {
    let snapshot = read_snapshot(&state).unwrap_or_else(|_| default_snapshot());
    Json(snapshot.presets)
}

async fn list_workflows(State(state): State<Arc<AppState>>) -> Json<Vec<WorkflowDefinition>> {
    let snapshot = read_snapshot(&state).unwrap_or_else(|_| default_snapshot());
    Json(snapshot.workflows)
}

async fn run_route_handler(
    Path(route_id): Path<String>,
    Query(query): Query<RunRouteQuery>,
    State(state): State<Arc<AppState>>,
    body: Option<Json<RunRouteRequest>>,
) -> Result<Json<RunResult>, (axum::http::StatusCode, Json<ApiErrorBody>)> {
    let request = body.map(|payload| payload.0);
    let result = run_route_by_id(&state, route_id, request, query.environment)
        .await
        .map_err(|err| {
            (
                axum::http::StatusCode::BAD_GATEWAY,
                Json(ApiErrorBody {
                    error: format!("run failed: {}", err),
                }),
            )
        })?;
    Ok(Json(result))
}

#[derive(Debug, Clone, Deserialize)]
struct RunRouteQuery {
    #[serde(default)]
    environment: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct RunWorkflowQuery {
    #[serde(default)]
    environment: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct RunWithPayloadRequest {
    route_id: String,
    #[serde(default)]
    environment: Option<String>,
    #[serde(flatten)]
    overrides: RunRouteRequest,
}

async fn run_with_payload_handler(
    State(state): State<Arc<AppState>>,
    Json(request): Json<RunWithPayloadRequest>,
) -> Result<Json<RunResult>, (axum::http::StatusCode, Json<ApiErrorBody>)> {
    let result = run_route_by_id(
        &state,
        request.route_id,
        Some(request.overrides),
        request.environment,
    )
    .await
    .map_err(|err| {
        (
            axum::http::StatusCode::BAD_GATEWAY,
            Json(ApiErrorBody {
                error: format!("run failed: {}", err),
            }),
        )
    })?;
    Ok(Json(result))
}

#[derive(Debug, Clone, Serialize)]
struct RunSummary {
    run_id: String,
    route_id: String,
    route_name: String,
    method: String,
    path: String,
    environment_name: String,
    created_at_ms: u64,
    status: u16,
    ok: bool,
}

async fn list_runs(State(state): State<Arc<AppState>>) -> Json<Vec<RunSummary>> {
    let history = state.run_history.read().await;
    Json(
        history
            .iter()
            .map(|item| RunSummary {
                run_id: item.run_id.clone(),
                route_id: item.route_id.clone(),
                route_name: item.route_name.clone(),
                method: item.method.clone(),
                path: item.path.clone(),
                environment_name: item.environment_name.clone(),
                created_at_ms: item.created_at_ms,
                status: item.result.status,
                ok: item.result.status < 400,
            })
            .collect(),
    )
}

async fn get_run_detail(
    Path(run_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<RunHistoryItem>, axum::http::StatusCode> {
    let history = state.run_history.read().await;
    let item = history
        .iter()
        .find(|entry| entry.run_id == run_id)
        .cloned()
        .ok_or(axum::http::StatusCode::NOT_FOUND)?;
    Ok(Json(item))
}

async fn get_run_artifact(
    Path(run_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<RunArtifact>, axum::http::StatusCode> {
    let history = state.run_history.read().await;
    let item = history
        .iter()
        .find(|entry| entry.run_id == run_id)
        .cloned()
        .ok_or(axum::http::StatusCode::NOT_FOUND)?;
    Ok(Json(RunArtifact {
        kind: "route-run".to_string(),
        run_id: item.run_id,
        environment_name: item.environment_name,
        created_at_ms: item.created_at_ms,
        request: serde_json::json!({
            "route_id": item.route_id,
            "route_name": item.route_name,
            "method": item.method,
            "path": item.path,
            "overrides": item.overrides,
        }),
        result: item.result,
    }))
}

async fn run_route_by_id(
    state: &Arc<AppState>,
    route_id: String,
    request: Option<RunRouteRequest>,
    environment_name: Option<String>,
) -> Result<RunResult> {
    let snapshot = read_snapshot(state)?;
    let route = snapshot
        .routes
        .iter()
        .find(|item| item.id == route_id)
        .ok_or_else(|| anyhow::anyhow!("route not found: {}", route_id))?;
    let route = if let Some(request) = request.clone() {
        apply_run_overrides(route, request)
    } else {
        route.clone()
    };

    let env = pick_environment(&snapshot, environment_name.as_deref(), &state.base_url)?;

    let base_url = env
        .variables
        .get("base_url")
        .filter(|value| !value.trim().is_empty())
        .map(String::as_str)
        .unwrap_or(&state.base_url);

    let mut result = run_route(&state.http_client, base_url, &route, env)
        .await
        .map_err(|err| {
            anyhow::anyhow!(
                "environment '{}' (base_url='{}') route '{}' failed: {}",
                env.name,
                base_url,
                route.id,
                err
            )
        })?;
    let run_id = Uuid::new_v4().to_string();
    result.run_id = run_id.clone();

    let created_at_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default();
    let item = RunHistoryItem {
        run_id,
        route_id: route.id.clone(),
        route_name: route.name.clone(),
        method: route.method.clone(),
        path: route.path.clone(),
        environment_name: env.name.clone(),
        created_at_ms,
        overrides: request,
        result: result.clone(),
    };
    let mut history = state.run_history.write().await;
    history.push_front(item);
    while history.len() > 300 {
        history.pop_back();
    }
    Ok(result)
}

async fn run_workflow_by_id(
    state: &Arc<AppState>,
    workflow_id: String,
    environment_name: Option<String>,
) -> Result<WorkflowRunHistoryItem> {
    let snapshot = read_snapshot(state)?;
    let workflow = snapshot
        .workflows
        .iter()
        .find(|item| item.id == workflow_id)
        .cloned()
        .ok_or_else(|| anyhow::anyhow!("workflow not found: {}", workflow_id))?;
    let env = pick_environment(&snapshot, environment_name.as_deref(), &state.base_url)?;
    let base_url = env
        .variables
        .get("base_url")
        .filter(|value| !value.trim().is_empty())
        .map(String::as_str)
        .unwrap_or(&state.base_url);

    let mut shared_context: BTreeMap<String, String> = BTreeMap::new();
    let mut steps = Vec::new();
    for step in &workflow.steps {
        let route = snapshot
            .routes
            .iter()
            .find(|item| item.id == step.route_id)
            .ok_or_else(|| anyhow::anyhow!("route not found for step: {}", step.route_id))?
            .clone();

        let mut route_with_step_vars = route;
        if !step.vars.is_empty() {
            for var in &step.vars {
                if var.enabled == Some(false) {
                    continue;
                }
                let resolved_value =
                    resolve_with_context(&var.value, &shared_context, &env.variables);
                let token = format!("{{{{{}}}}}", var.key);
                route_with_step_vars.path =
                    route_with_step_vars.path.replace(&token, &resolved_value);
                for value in route_with_step_vars.headers.values_mut() {
                    *value = value.replace(&token, &resolved_value);
                }
                if let Some(body) = &mut route_with_step_vars.body {
                    replace_json_tokens(body, &token, &resolved_value);
                }
            }
        }

        let mut env_for_step = env.clone();
        for (key, value) in &shared_context {
            env_for_step.variables.insert(key.clone(), value.clone());
        }
        let run = run_route(
            &state.http_client,
            base_url,
            &route_with_step_vars,
            &env_for_step,
        )
        .await
        .map_err(|err| anyhow::anyhow!("step '{}' failed: {}", step.route_id, err))?;
        for rule in &step.extract {
            if let Some(body) = &run.response_body {
                if let Some(value) = json_path_get(body, &rule.path) {
                    let text = match value {
                        Value::String(text) => text.clone(),
                        other => other.to_string(),
                    };
                    shared_context.insert(rule.key.clone(), text);
                }
            }
        }
        let step_name = step.name.clone().unwrap_or_else(|| step.route_id.clone());
        steps.push(WorkflowStepResult {
            step_name,
            route_id: step.route_id.clone(),
            run,
        });
    }

    let run_id = Uuid::new_v4().to_string();
    let created_at_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default();
    let item = WorkflowRunHistoryItem {
        run_id,
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        environment_name: env.name.clone(),
        created_at_ms,
        steps,
        shared_context,
    };

    let mut history = state.workflow_history.write().await;
    history.push_front(item.clone());
    while history.len() > 300 {
        history.pop_back();
    }
    Ok(item)
}

fn pick_environment<'a>(
    snapshot: &'a WorkspaceSnapshot,
    explicit_name: Option<&str>,
    fallback_base_url: &str,
) -> Result<&'a EnvironmentConfig> {
    if snapshot.environments.is_empty() {
        return Err(anyhow::anyhow!(
            "no environment configured (fallback base URL: {})",
            fallback_base_url
        ));
    }
    let env = explicit_name
        .and_then(|name| snapshot.environments.iter().find(|item| item.name == name))
        .or_else(|| {
            snapshot
                .environments
                .iter()
                .find(|item| item.name == snapshot.project.default_environment)
        })
        .or_else(|| snapshot.environments.first())
        .ok_or_else(|| anyhow::anyhow!("no environment configured"))?;
    Ok(env)
}

fn json_path_get<'a>(value: &'a Value, path: &str) -> Option<&'a Value> {
    let mut current = value;
    for segment in path.trim_start_matches("$.").split('.') {
        if segment.is_empty() {
            continue;
        }
        if let Some((key, index)) = parse_array_segment(segment) {
            current = current.get(key)?;
            current = current.get(index)?;
            continue;
        }
        current = current.get(segment)?;
    }
    Some(current)
}

fn parse_array_segment(segment: &str) -> Option<(&str, usize)> {
    let open = segment.find('[')?;
    let close = segment.find(']')?;
    if close <= open + 1 {
        return None;
    }
    let key = &segment[..open];
    let index = segment[(open + 1)..close].parse::<usize>().ok()?;
    Some((key, index))
}

fn resolve_with_context(
    raw: &str,
    shared_context: &BTreeMap<String, String>,
    env_vars: &BTreeMap<String, String>,
) -> String {
    let mut output = raw.to_string();
    for (key, value) in shared_context {
        output = output.replace(&format!("{{{{{}}}}}", key), value);
    }
    for (key, value) in env_vars {
        output = output.replace(&format!("{{{{{}}}}}", key), value);
    }
    output
}

async fn rerun_handler(
    Path(run_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<RunResult>, (axum::http::StatusCode, Json<ApiErrorBody>)> {
    let history = state.run_history.read().await;
    let item = history
        .iter()
        .find(|entry| entry.run_id == run_id)
        .cloned()
        .ok_or((
            axum::http::StatusCode::NOT_FOUND,
            Json(ApiErrorBody {
                error: "run not found".to_string(),
            }),
        ))?;
    drop(history);
    let result = run_route_by_id(
        &state,
        item.route_id,
        item.overrides,
        Some(item.environment_name),
    )
    .await
    .map_err(|err| {
        (
            axum::http::StatusCode::BAD_GATEWAY,
            Json(ApiErrorBody {
                error: format!("re-run failed: {}", err),
            }),
        )
    })?;
    Ok(Json(result))
}

async fn run_workflow_handler(
    Path(workflow_id): Path<String>,
    Query(query): Query<RunWorkflowQuery>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<WorkflowRunHistoryItem>, (axum::http::StatusCode, Json<ApiErrorBody>)> {
    let result = run_workflow_by_id(&state, workflow_id, query.environment)
        .await
        .map_err(|err| {
            (
                axum::http::StatusCode::BAD_GATEWAY,
                Json(ApiErrorBody {
                    error: format!("workflow run failed: {}", err),
                }),
            )
        })?;
    Ok(Json(result))
}

async fn list_workflow_runs(
    State(state): State<Arc<AppState>>,
) -> Json<Vec<WorkflowRunHistoryItem>> {
    let history = state.workflow_history.read().await;
    Json(history.iter().cloned().collect())
}

async fn get_workflow_run_detail(
    Path(run_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<WorkflowRunHistoryItem>, axum::http::StatusCode> {
    let history = state.workflow_history.read().await;
    let item = history
        .iter()
        .find(|entry| entry.run_id == run_id)
        .cloned()
        .ok_or(axum::http::StatusCode::NOT_FOUND)?;
    Ok(Json(item))
}

async fn get_workflow_run_artifact(
    Path(run_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<WorkflowRunArtifact>, axum::http::StatusCode> {
    let history = state.workflow_history.read().await;
    let item = history
        .iter()
        .find(|entry| entry.run_id == run_id)
        .cloned()
        .ok_or(axum::http::StatusCode::NOT_FOUND)?;
    Ok(Json(WorkflowRunArtifact {
        kind: "workflow-run".to_string(),
        run_id: item.run_id,
        workflow_id: item.workflow_id,
        workflow_name: item.workflow_name,
        environment_name: item.environment_name,
        created_at_ms: item.created_at_ms,
        steps: item.steps,
        shared_context: item.shared_context,
    }))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RunRouteRequest {
    #[serde(default)]
    method: Option<String>,
    #[serde(default)]
    path: Option<String>,
    #[serde(default)]
    headers: Option<BTreeMap<String, String>>,
    #[serde(default)]
    body: Option<Value>,
    #[serde(default)]
    tests: Option<Vec<RouteTest>>,
    #[serde(default)]
    auth: Option<RunAuthConfig>,
    #[serde(default)]
    vars: Option<Vec<RouteVar>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RunAuthConfig {
    #[serde(default)]
    r#type: Option<String>,
    #[serde(default)]
    basic: Option<RunBasicAuth>,
    #[serde(default)]
    bearer: Option<RunBearerAuth>,
    #[serde(default)]
    api_key: Option<RunApiKeyAuth>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RunBasicAuth {
    #[serde(default)]
    username: Option<String>,
    #[serde(default)]
    password: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RunBearerAuth {
    #[serde(default)]
    token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RunApiKeyAuth {
    #[serde(default)]
    key: Option<String>,
    #[serde(default)]
    value: Option<String>,
    #[serde(default)]
    add_to: Option<String>,
}

fn apply_run_overrides(route: &RouteDefinition, request: RunRouteRequest) -> RouteDefinition {
    let mut next = route.clone();
    if let Some(method) = request.method {
        next.method = method.to_uppercase();
    }
    if let Some(path) = request.path {
        next.path = path;
    }
    if let Some(headers) = request.headers {
        next.headers = headers;
    }
    if let Some(body) = request.body {
        next.body = Some(body);
    }
    if let Some(tests) = request.tests {
        next.tests = tests;
    }

    let vars = request.vars.unwrap_or_default();
    if !vars.is_empty() {
        for var in vars {
            if var.enabled == Some(false) {
                continue;
            }
            let token = format!("{{{{{}}}}}", var.key);
            next.path = next.path.replace(&token, &var.value);
            for value in next.headers.values_mut() {
                *value = value.replace(&token, &var.value);
            }
            if let Some(body) = &mut next.body {
                replace_json_tokens(body, &token, &var.value);
            }
        }
    }

    if let Some(auth) = request.auth {
        let auth_type = auth.r#type.unwrap_or_else(|| "none".to_string());
        match auth_type.as_str() {
            "basic" => {
                if let Some(basic) = auth.basic {
                    if let (Some(username), Some(password)) = (basic.username, basic.password) {
                        use base64::engine::general_purpose::STANDARD;
                        use base64::Engine;
                        let encoded = STANDARD.encode(format!("{}:{}", username, password));
                        next.headers
                            .insert("Authorization".to_string(), format!("Basic {}", encoded));
                    }
                }
            }
            "bearer" => {
                if let Some(bearer) = auth.bearer {
                    if let Some(token) = bearer.token {
                        if !token.trim().is_empty() {
                            next.headers
                                .insert("Authorization".to_string(), format!("Bearer {}", token));
                        }
                    }
                }
            }
            "api_key" => {
                if let Some(api_key) = auth.api_key {
                    let key = api_key.key.unwrap_or_default();
                    let value = api_key.value.unwrap_or_default();
                    if !key.is_empty() {
                        if api_key.add_to.as_deref() == Some("query") {
                            let separator = if next.path.contains('?') { "&" } else { "?" };
                            next.path = format!("{}{}{}={}", next.path, separator, key, value);
                        } else {
                            next.headers.insert(key, value);
                        }
                    }
                }
            }
            _ => {}
        }
    }

    next
}

fn replace_json_tokens(value: &mut Value, token: &str, replacement: &str) {
    match value {
        Value::String(current) => {
            *current = current.replace(token, replacement);
        }
        Value::Array(items) => {
            for item in items {
                replace_json_tokens(item, token, replacement);
            }
        }
        Value::Object(map) => {
            for item in map.values_mut() {
                replace_json_tokens(item, token, replacement);
            }
        }
        _ => {}
    }
}

async fn events_handler(
    State(state): State<Arc<AppState>>,
) -> Sse<impl tokio_stream::Stream<Item = Result<Event, Infallible>>> {
    let rx = state.workspace_events.subscribe();
    let stream = BroadcastStream::new(rx).filter_map(|message| match message {
        Ok(_) => Some(Ok(Event::default()
            .event("workspace-updated")
            .data("changed"))),
        Err(_) => None,
    });

    Sse::new(stream).keep_alive(KeepAlive::default())
}

async fn rest_resource_handler(
    method: Method,
    body: Bytes,
) -> Result<impl IntoResponse, axum::http::StatusCode> {
    let payload = if body.is_empty() {
        None
    } else {
        serde_json::from_slice::<serde_json::Value>(&body).ok()
    };

    match method {
        Method::GET => Ok((
            axum::http::StatusCode::OK,
            Json(serde_json::json!({
                "method": "GET",
                "resource": {
                    "id": "res_001",
                    "name": "Boson Demo Resource",
                    "status": "active"
                }
            })),
        )
            .into_response()),
        Method::POST => Ok((
            axum::http::StatusCode::CREATED,
            Json(serde_json::json!({
                "method": "POST",
                "created": true,
                "input": payload
            })),
        )
            .into_response()),
        Method::PUT => Ok((
            axum::http::StatusCode::OK,
            Json(serde_json::json!({
                "method": "PUT",
                "updated": true,
                "input": payload
            })),
        )
            .into_response()),
        Method::PATCH => Ok((
            axum::http::StatusCode::OK,
            Json(serde_json::json!({
                "method": "PATCH",
                "patched": true,
                "input": payload
            })),
        )
            .into_response()),
        Method::DELETE => Ok(axum::http::StatusCode::NO_CONTENT.into_response()),
        Method::HEAD => Ok(axum::http::StatusCode::OK.into_response()),
        Method::OPTIONS => Ok((
            axum::http::StatusCode::NO_CONTENT,
            [("Allow", "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS")],
        )
            .into_response()),
        _ => Err(axum::http::StatusCode::METHOD_NOT_ALLOWED),
    }
}

async fn rest_search_handler() -> impl IntoResponse {
    Json(serde_json::json!({
        "method": "GET",
        "hint": "Add query params to this endpoint from route definitions.",
        "example": "/demo/rest/search?limit=10&cursor=abc"
    }))
}

async fn rest_headers_handler() -> impl IntoResponse {
    let mut headers = HeaderMap::new();
    headers.insert("x-boson-demo", HeaderValue::from_static("headers-tab"));
    headers.insert("x-boson-version", HeaderValue::from_static("local-mvp"));
    headers.insert(
        "cache-control",
        HeaderValue::from_static("public, max-age=120"),
    );
    headers.append(
        "set-cookie",
        HeaderValue::from_static("boson_session=abc123; Path=/; HttpOnly"),
    );
    headers.append(
        "set-cookie",
        HeaderValue::from_static("boson_flags=beta,headers; Path=/"),
    );

    (
        StatusCode::OK,
        headers,
        Json(serde_json::json!({
            "message": "Demo endpoint with custom headers",
            "purpose": "Validate headers tab rendering in Boson UI"
        })),
    )
}

fn read_snapshot(state: &AppState) -> Result<WorkspaceSnapshot> {
    load_workspace(&state.root_dir)
}

fn default_snapshot() -> WorkspaceSnapshot {
    WorkspaceSnapshot {
        project: boson_core::schema::ProjectConfig {
            schema_version: "1".to_string(),
            name: "Boson".to_string(),
            default_environment: "local".to_string(),
        },
        environments: Vec::new(),
        presets: Vec::new(),
        workflows: Vec::new(),
        routes: Vec::new(),
    }
}

fn start_workspace_watcher(
    api_dir: PathBuf,
    events: broadcast::Sender<()>,
) -> Result<RecommendedWatcher> {
    let mut watcher = RecommendedWatcher::new(
        move |res: notify::Result<notify::Event>| match res {
            Ok(event) => {
                if is_relevant_fs_event(&event.kind) {
                    let _ = events.send(());
                }
            }
            Err(err) => warn!("workspace watch error: {}", err),
        },
        Config::default(),
    )?;

    if api_dir.exists() {
        watcher.watch(&api_dir, RecursiveMode::Recursive)?;
    } else {
        warn!(
            "workspace watch path does not exist yet: {}",
            api_dir.display()
        );
    }
    Ok(watcher)
}

fn is_relevant_fs_event(kind: &EventKind) -> bool {
    matches!(
        kind,
        EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_) | EventKind::Any
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{extract::Path as AxumPath, http::HeaderMap as AxumHeaderMap, routing::post, Json};
    use serde_json::json;
    use std::fs;
    use tempfile::tempdir;
    use tokio::{net::TcpListener, task::JoinHandle};

    async fn start_echo_server() -> (String, JoinHandle<()>) {
        async fn echo_handler(
            AxumPath(tenant): AxumPath<String>,
            headers: AxumHeaderMap,
            Json(body): Json<Value>,
        ) -> Json<Value> {
            let x_tenant = headers
                .get("x-tenant")
                .and_then(|value| value.to_str().ok())
                .unwrap_or_default()
                .to_string();
            let auth = headers
                .get("authorization")
                .and_then(|value| value.to_str().ok())
                .unwrap_or_default()
                .to_string();
            Json(json!({
                "tenant_path": tenant,
                "x_tenant": x_tenant,
                "authorization": auth,
                "body": body
            }))
        }

        let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind echo");
        let addr = listener.local_addr().expect("echo addr");
        let app = Router::new().route("/echo/:tenant", post(echo_handler));
        let handle = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });
        (format!("http://{}", addr), handle)
    }

    fn write_json_file(path: &std::path::Path, value: Value) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("create parent");
        }
        let content = serde_json::to_string_pretty(&value).expect("json");
        fs::write(path, format!("{}\n", content)).expect("write");
    }

    async fn wait_for_health(base_url: &str) {
        let client = reqwest::Client::new();
        for _ in 0..50 {
            if let Ok(response) = client.get(format!("{}/health", base_url)).send().await {
                if response.status().is_success() {
                    return;
                }
            }
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        }
        panic!("server did not become healthy in time");
    }

    #[tokio::test]
    async fn environment_switching_resolves_payload_and_history_env_label() {
        let workspace = tempdir().expect("tempdir");
        let root = workspace.path();
        let (target_base_url, target_handle) = start_echo_server().await;

        write_json_file(
            &root.join(".api/project.json"),
            json!({
              "schema_version": "1",
              "name": "Boson Test",
              "default_environment": "env-a"
            }),
        );
        write_json_file(
            &root.join(".api/environments/env-a.json"),
            json!({
              "name": "env-a",
              "variables": {
                "base_url": target_base_url,
                "tenant": "alpha",
                "token": "token-a"
              }
            }),
        );
        write_json_file(
            &root.join(".api/environments/env-b.json"),
            json!({
              "name": "env-b",
              "variables": {
                "base_url": target_base_url,
                "tenant": "beta",
                "token": "token-b"
              }
            }),
        );
        write_json_file(
            &root.join(".api/routes/env-check.json"),
            json!({
              "id": "env-check",
              "name": "Environment Check",
              "method": "POST",
              "path": "/echo/{{tenant}}",
              "headers": {
                "x-tenant": "{{tenant}}",
                "authorization": "Bearer {{token}}",
                "content-type": "application/json"
              },
              "body": {
                "tenant": "{{tenant}}",
                "token": "{{token}}"
              },
              "tests": []
            }),
        );

        let server_listener = TcpListener::bind("127.0.0.1:0").await.expect("bind server");
        let server_addr = server_listener.local_addr().expect("server addr");
        drop(server_listener);

        let server_handle = tokio::spawn(run_local_server(
            root.to_path_buf(),
            "http://127.0.0.1:8787".to_string(),
            server_addr,
        ));
        let server_base_url = format!("http://{}", server_addr);
        wait_for_health(&server_base_url).await;
        let client = reqwest::Client::new();

        let run_a: Value = client
            .post(format!(
                "{}/api/run/env-check?environment=env-a",
                server_base_url
            ))
            .send()
            .await
            .expect("run env a")
            .error_for_status()
            .expect("status env a")
            .json()
            .await
            .expect("json env a");

        let run_b: Value = client
            .post(format!(
                "{}/api/run/env-check?environment=env-b",
                server_base_url
            ))
            .send()
            .await
            .expect("run env b")
            .error_for_status()
            .expect("status env b")
            .json()
            .await
            .expect("json env b");

        assert_eq!(
            run_a
                .get("response_body")
                .and_then(|value| value.get("tenant_path"))
                .and_then(Value::as_str),
            Some("alpha")
        );
        assert_eq!(
            run_a
                .get("response_body")
                .and_then(|value| value.get("x_tenant"))
                .and_then(Value::as_str),
            Some("alpha")
        );
        assert_eq!(
            run_a
                .get("response_body")
                .and_then(|value| value.get("body"))
                .and_then(|value| value.get("token"))
                .and_then(Value::as_str),
            Some("token-a")
        );

        assert_eq!(
            run_b
                .get("response_body")
                .and_then(|value| value.get("tenant_path"))
                .and_then(Value::as_str),
            Some("beta")
        );
        assert_eq!(
            run_b
                .get("response_body")
                .and_then(|value| value.get("x_tenant"))
                .and_then(Value::as_str),
            Some("beta")
        );
        assert_eq!(
            run_b
                .get("response_body")
                .and_then(|value| value.get("body"))
                .and_then(|value| value.get("token"))
                .and_then(Value::as_str),
            Some("token-b")
        );

        let history: Vec<Value> = client
            .get(format!("{}/api/runs", server_base_url))
            .send()
            .await
            .expect("list runs")
            .error_for_status()
            .expect("status runs")
            .json()
            .await
            .expect("runs json");
        let mut envs = history
            .iter()
            .map(|item| {
                item.get("environment_name")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string()
            })
            .collect::<Vec<_>>();
        envs.sort();
        assert_eq!(envs, vec!["env-a".to_string(), "env-b".to_string()]);

        server_handle.abort();
        target_handle.abort();
    }

    #[tokio::test]
    async fn exposes_loaded_presets_via_api() {
        let workspace = tempdir().expect("tempdir");
        let root = workspace.path();
        write_json_file(
            &root.join(".api/project.json"),
            json!({
              "schema_version": "1",
              "name": "Boson Test",
              "default_environment": "local"
            }),
        );
        write_json_file(
            &root.join(".api/environments/local.json"),
            json!({
              "name": "local",
              "variables": { "base_url": "http://127.0.0.1:8787" }
            }),
        );
        write_json_file(
            &root.join(".api/presets/json-defaults.json"),
            json!({
              "id": "json-defaults",
              "name": "JSON Defaults",
              "headers": {
                "content-type": "application/json",
                "accept": "application/json"
              },
              "body_config": {
                "mode": "json",
                "raw": "{\"ok\":true}"
              }
            }),
        );
        write_json_file(
            &root.join(".api/routes/ping.json"),
            json!({
              "id": "ping",
              "name": "Ping",
              "method": "GET",
              "path": "/demo/rest/resource",
              "headers": {},
              "tests": []
            }),
        );

        let server_listener = TcpListener::bind("127.0.0.1:0").await.expect("bind server");
        let server_addr = server_listener.local_addr().expect("server addr");
        drop(server_listener);
        let server_handle = tokio::spawn(run_local_server(
            root.to_path_buf(),
            "http://127.0.0.1:8787".to_string(),
            server_addr,
        ));

        let server_base_url = format!("http://{}", server_addr);
        wait_for_health(&server_base_url).await;
        let client = reqwest::Client::new();
        let presets: Vec<Value> = client
            .get(format!("{}/api/presets", server_base_url))
            .send()
            .await
            .expect("list presets")
            .error_for_status()
            .expect("status presets")
            .json()
            .await
            .expect("presets json");

        assert_eq!(presets.len(), 1);
        assert_eq!(
            presets[0].get("id").and_then(Value::as_str),
            Some("json-defaults")
        );
        assert_eq!(
            presets[0].get("source_path").and_then(Value::as_str),
            Some("json-defaults.json")
        );

        server_handle.abort();
    }

    #[tokio::test]
    async fn runs_workflow_and_exposes_artifact_endpoints() {
        let workspace = tempdir().expect("tempdir");
        let root = workspace.path();
        let (target_base_url, target_handle) = start_echo_server().await;

        write_json_file(
            &root.join(".api/project.json"),
            json!({
              "schema_version": "1",
              "name": "Boson Test",
              "default_environment": "local"
            }),
        );
        write_json_file(
            &root.join(".api/environments/local.json"),
            json!({
              "name": "local",
              "variables": {
                "base_url": target_base_url,
                "tenant": "alpha"
              }
            }),
        );
        write_json_file(
            &root.join(".api/routes/seed.json"),
            json!({
              "id": "seed",
              "name": "Seed",
              "method": "POST",
              "path": "/echo/{{tenant}}",
              "headers": {
                "content-type": "application/json"
              },
              "body": {
                "seed_id": "seed-123"
              },
              "tests": []
            }),
        );
        write_json_file(
            &root.join(".api/routes/use-token.json"),
            json!({
              "id": "use-token",
              "name": "Use Token",
              "method": "POST",
              "path": "/echo/{{tenant}}",
              "headers": {
                "x-seed": "{{seed_id}}",
                "content-type": "application/json"
              },
              "body": {
                "from_workflow": "{{seed_id}}"
              },
              "tests": []
            }),
        );
        write_json_file(
            &root.join(".api/workflows/demo.json"),
            json!({
              "id": "demo-flow",
              "name": "Demo Flow",
              "steps": [
                {
                  "route_id": "seed",
                  "extract": [
                    { "key": "seed_id", "path": "$.body.seed_id" }
                  ]
                },
                {
                  "route_id": "use-token"
                }
              ]
            }),
        );

        let server_listener = TcpListener::bind("127.0.0.1:0").await.expect("bind server");
        let server_addr = server_listener.local_addr().expect("server addr");
        drop(server_listener);
        let server_handle = tokio::spawn(run_local_server(
            root.to_path_buf(),
            "http://127.0.0.1:8787".to_string(),
            server_addr,
        ));
        let server_base_url = format!("http://{}", server_addr);
        wait_for_health(&server_base_url).await;
        let client = reqwest::Client::new();

        let workflow_list: Vec<Value> = client
            .get(format!("{}/api/workflows", server_base_url))
            .send()
            .await
            .expect("list workflows")
            .error_for_status()
            .expect("status workflows")
            .json()
            .await
            .expect("workflows json");
        assert_eq!(workflow_list.len(), 1);
        assert_eq!(
            workflow_list[0].get("id").and_then(Value::as_str),
            Some("demo-flow")
        );

        let workflow_run: Value = client
            .post(format!("{}/api/workflows/demo-flow/run", server_base_url))
            .send()
            .await
            .expect("run workflow")
            .error_for_status()
            .expect("status workflow")
            .json()
            .await
            .expect("workflow run json");
        assert_eq!(
            workflow_run
                .get("steps")
                .and_then(Value::as_array)
                .map(|items| items.len()),
            Some(2)
        );
        assert_eq!(
            workflow_run
                .get("shared_context")
                .and_then(|ctx| ctx.get("seed_id"))
                .and_then(Value::as_str),
            Some("seed-123")
        );

        let workflow_run_id = workflow_run
            .get("run_id")
            .and_then(Value::as_str)
            .expect("workflow run id");
        let workflow_artifact: Value = client
            .get(format!(
                "{}/api/workflow-runs/{}/artifact",
                server_base_url, workflow_run_id
            ))
            .send()
            .await
            .expect("workflow artifact")
            .error_for_status()
            .expect("status workflow artifact")
            .json()
            .await
            .expect("artifact json");
        assert_eq!(
            workflow_artifact.get("kind").and_then(Value::as_str),
            Some("workflow-run")
        );

        let route_run: Value = client
            .post(format!("{}/api/run/seed", server_base_url))
            .send()
            .await
            .expect("run route")
            .error_for_status()
            .expect("status route")
            .json()
            .await
            .expect("route run json");
        let run_id = route_run
            .get("run_id")
            .and_then(Value::as_str)
            .expect("route run id");
        let route_artifact: Value = client
            .get(format!("{}/api/runs/{}/artifact", server_base_url, run_id))
            .send()
            .await
            .expect("route artifact")
            .error_for_status()
            .expect("status route artifact")
            .json()
            .await
            .expect("route artifact json");
        assert_eq!(
            route_artifact.get("kind").and_then(Value::as_str),
            Some("route-run")
        );

        server_handle.abort();
        target_handle.abort();
    }

    #[test]
    fn resolves_step_values_with_environment_and_shared_context() {
        let env_vars = BTreeMap::from([
            ("tenant".to_string(), "env-tenant".to_string()),
            ("token".to_string(), "env-token".to_string()),
        ]);
        let shared = BTreeMap::from([("token".to_string(), "shared-token".to_string())]);
        let value = resolve_with_context("{{tenant}}::{{token}}", &shared, &env_vars);
        assert_eq!(value, "env-tenant::shared-token");
    }
}
