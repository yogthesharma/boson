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
    schema::{EnvironmentConfig, RouteDefinition, RouteTest, RouteVar, WorkspaceSnapshot},
};
use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{BTreeMap, VecDeque},
    convert::Infallible,
    fs,
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

pub async fn run_local_server(root_dir: PathBuf, base_url: String, addr: SocketAddr) -> Result<()> {
    let (workspace_events, _) = broadcast::channel(128);
    let _watcher = start_workspace_watcher(root_dir.join(".api"), workspace_events.clone())?;

    let state = Arc::new(AppState {
        root_dir,
        base_url,
        http_client: Client::new(),
        workspace_events,
        run_history: Arc::new(RwLock::new(VecDeque::new())),
    });

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/routes", get(list_routes))
        .route("/api/environments", get(list_environments).post(create_environment))
        .route(
            "/api/environments/:name",
            axum::routing::put(update_environment).delete(delete_environment),
        )
        .route("/api/run/:route_id", post(run_route_handler))
        .route("/api/runs", get(list_runs).post(run_with_payload_handler))
        .route("/api/runs/:run_id", get(get_run_detail))
        .route("/api/runs/:run_id/re-run", post(rerun_handler))
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

async fn list_environments(State(state): State<Arc<AppState>>) -> Json<Vec<EnvironmentConfig>> {
    let snapshot = read_snapshot(&state).unwrap_or_else(|_| default_snapshot());
    Json(snapshot.environments)
}

async fn create_environment(
    State(state): State<Arc<AppState>>,
    Json(environment): Json<EnvironmentConfig>,
) -> Result<Json<EnvironmentConfig>, axum::http::StatusCode> {
    write_environment_file(&state.root_dir, &environment, None)
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let _ = state.workspace_events.send(());
    Ok(Json(environment))
}

async fn update_environment(
    Path(name): Path<String>,
    State(state): State<Arc<AppState>>,
    Json(environment): Json<EnvironmentConfig>,
) -> Result<Json<EnvironmentConfig>, axum::http::StatusCode> {
    write_environment_file(&state.root_dir, &environment, Some(name))
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let _ = state.workspace_events.send(());
    Ok(Json(environment))
}

async fn delete_environment(
    Path(name): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<StatusCode, axum::http::StatusCode> {
    let path = find_environment_file(&state.root_dir, &name)
        .ok_or(axum::http::StatusCode::NOT_FOUND)?;
    fs::remove_file(path).map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let _ = state.workspace_events.send(());
    Ok(StatusCode::NO_CONTENT)
}

async fn run_route_handler(
    Path(route_id): Path<String>,
    Query(query): Query<RunRouteQuery>,
    State(state): State<Arc<AppState>>,
    body: Option<Json<RunRouteRequest>>,
) -> Result<Json<RunResult>, axum::http::StatusCode> {
    let request = body.map(|payload| payload.0);
    let result = run_route_by_id(&state, route_id, request, query.environment)
        .await
        .map_err(|_| axum::http::StatusCode::BAD_GATEWAY)?;
    Ok(Json(result))
}

#[derive(Debug, Clone, Deserialize)]
struct RunRouteQuery {
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
) -> Result<Json<RunResult>, axum::http::StatusCode> {
    let result = run_route_by_id(
        &state,
        request.route_id,
        Some(request.overrides),
        request.environment,
    )
        .await
        .map_err(|_| axum::http::StatusCode::BAD_GATEWAY)?;
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

async fn run_route_by_id(
    state: &Arc<AppState>,
    route_id: String,
    request: Option<RunRouteRequest>,
    environment_name: Option<String>,
) -> Result<RunResult> {
    let snapshot = read_snapshot(&state)?;
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

    let env = environment_name
        .as_deref()
        .and_then(|name| snapshot.environments.iter().find(|item| item.name == name))
        .or_else(|| {
            snapshot
                .environments
                .iter()
                .find(|item| item.name == snapshot.project.default_environment)
        })
        .or_else(|| snapshot.environments.first())
        .ok_or_else(|| anyhow::anyhow!("no environment configured"))?;

    let base_url = env
        .variables
        .get("base_url")
        .filter(|value| !value.trim().is_empty())
        .map(String::as_str)
        .unwrap_or(&state.base_url);

    let mut result = run_route(&state.http_client, base_url, &route, env).await?;
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

async fn rerun_handler(
    Path(run_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<RunResult>, axum::http::StatusCode> {
    let history = state.run_history.read().await;
    let item = history
        .iter()
        .find(|entry| entry.run_id == run_id)
        .cloned()
        .ok_or(axum::http::StatusCode::NOT_FOUND)?;
    drop(history);
    let result = run_route_by_id(
        &state,
        item.route_id,
        item.overrides,
        Some(item.environment_name),
    )
        .await
        .map_err(|_| axum::http::StatusCode::BAD_GATEWAY)?;
    Ok(Json(result))
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
    let stream = BroadcastStream::new(rx).filter_map(|message| {
        match message {
            Ok(_) => Some(Ok(Event::default().event("workspace-updated").data("changed"))),
            Err(_) => None,
        }
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

fn environment_dir(root: &PathBuf) -> PathBuf {
    root.join(".api").join("environments")
}

fn find_environment_file(root: &PathBuf, name: &str) -> Option<PathBuf> {
    let dir = environment_dir(root);
    if !dir.exists() {
        return None;
    }
    let entries = fs::read_dir(&dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        let Ok(content) = fs::read_to_string(&path) else {
            continue;
        };
        let Ok(env) = serde_json::from_str::<EnvironmentConfig>(&content) else {
            continue;
        };
        if env.name == name {
            return Some(path);
        }
    }
    None
}

fn write_environment_file(
    root: &PathBuf,
    environment: &EnvironmentConfig,
    previous_name: Option<String>,
) -> Result<()> {
    let dir = environment_dir(root);
    fs::create_dir_all(&dir)?;
    if let Some(previous) = previous_name {
        if previous != environment.name {
            if let Some(old_file) = find_environment_file(root, &previous) {
                let _ = fs::remove_file(old_file);
            }
        }
    }

    let target_file = find_environment_file(root, &environment.name).unwrap_or_else(|| {
        let safe = environment
            .name
            .to_lowercase()
            .chars()
            .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
            .collect::<String>();
        dir.join(format!("{}.json", safe.trim_matches('-')))
    });
    let content = serde_json::to_string_pretty(environment)?;
    fs::write(target_file, format!("{}\n", content))?;
    Ok(())
}
