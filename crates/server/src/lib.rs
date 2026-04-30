use anyhow::Result;
use axum::{
    body::Bytes,
    extract::{Path, State},
    http::Method,
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
    schema::{EnvironmentConfig, RouteDefinition, WorkspaceSnapshot},
};
use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use reqwest::Client;
use std::{convert::Infallible, net::SocketAddr, path::PathBuf, sync::Arc};
use tokio::net::TcpListener;
use tokio::sync::broadcast;
use tokio_stream::{wrappers::BroadcastStream, StreamExt};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::warn;

#[derive(Clone)]
pub struct AppState {
    pub root_dir: PathBuf,
    pub base_url: String,
    pub http_client: Client,
    pub workspace_events: broadcast::Sender<()>,
}

pub async fn run_local_server(root_dir: PathBuf, base_url: String, addr: SocketAddr) -> Result<()> {
    let (workspace_events, _) = broadcast::channel(128);
    let _watcher = start_workspace_watcher(root_dir.join(".api"), workspace_events.clone())?;

    let state = Arc::new(AppState {
        root_dir,
        base_url,
        http_client: Client::new(),
        workspace_events,
    });

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/routes", get(list_routes))
        .route("/api/environments", get(list_environments))
        .route("/api/run/:route_id", post(run_route_handler))
        .route("/api/events", get(events_handler))
        .route("/demo/rest/resource", any(rest_resource_handler))
        .route("/demo/rest/search", get(rest_search_handler))
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

async fn run_route_handler(
    Path(route_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<RunResult>, axum::http::StatusCode> {
    let snapshot = read_snapshot(&state).map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let route = snapshot
        .routes
        .iter()
        .find(|item| item.id == route_id)
        .ok_or(axum::http::StatusCode::NOT_FOUND)?;

    let env = snapshot
        .environments
        .iter()
        .find(|item| item.name == snapshot.project.default_environment)
        .or_else(|| snapshot.environments.first())
        .ok_or(axum::http::StatusCode::BAD_REQUEST)?;

    let base_url = env
        .variables
        .get("base_url")
        .filter(|value| !value.trim().is_empty())
        .map(String::as_str)
        .unwrap_or(&state.base_url);

    let result = run_route(&state.http_client, base_url, route, env)
        .await
        .map_err(|_| axum::http::StatusCode::BAD_GATEWAY)?;
    Ok(Json(result))
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
