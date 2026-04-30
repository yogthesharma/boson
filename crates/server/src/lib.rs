use anyhow::Result;
use axum::{
    extract::{Path, State},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use reqwest::Client;
use routepad_core::{
    execution::{run_route, RunResult},
    loader::load_workspace,
    schema::{EnvironmentConfig, RouteDefinition, WorkspaceSnapshot},
};
use std::{net::SocketAddr, path::PathBuf, sync::Arc};
use tokio::net::TcpListener;
use tower_http::trace::TraceLayer;

#[derive(Clone)]
pub struct AppState {
    pub root_dir: PathBuf,
    pub base_url: String,
    pub http_client: Client,
}

pub async fn run_local_server(root_dir: PathBuf, base_url: String, addr: SocketAddr) -> Result<()> {
    let state = Arc::new(AppState {
        root_dir,
        base_url,
        http_client: Client::new(),
    });

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/routes", get(list_routes))
        .route("/api/environments", get(list_environments))
        .route("/api/run/:route_id", post(run_route_handler))
        .with_state(state)
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

    let result = run_route(&state.http_client, &state.base_url, route, env)
        .await
        .map_err(|_| axum::http::StatusCode::BAD_GATEWAY)?;
    Ok(Json(result))
}

fn read_snapshot(state: &AppState) -> Result<WorkspaceSnapshot> {
    load_workspace(&state.root_dir)
}

fn default_snapshot() -> WorkspaceSnapshot {
    WorkspaceSnapshot {
        project: routepad_core::schema::ProjectConfig {
            schema_version: "1".to_string(),
            name: "Boson".to_string(),
            default_environment: "local".to_string(),
        },
        environments: Vec::new(),
        routes: Vec::new(),
    }
}
