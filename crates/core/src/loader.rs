use crate::schema::{EnvironmentConfig, ProjectConfig, RouteDefinition, WorkspaceSnapshot};
use anyhow::{Context, Result};
use std::fs;
use std::path::Path;

pub fn load_workspace(root: &Path) -> Result<WorkspaceSnapshot> {
    let api_root = root.join(".api");
    let project: ProjectConfig = read_json(&api_root.join("project.json"))
        .with_context(|| "failed to load .api/project.json")?;

    let environments_dir = api_root.join("environments");
    let routes_dir = api_root.join("routes");

    let environments = read_json_dir::<EnvironmentConfig>(&environments_dir)
        .with_context(|| "failed to load environment files")?;
    let routes = read_json_dir::<RouteDefinition>(&routes_dir)
        .with_context(|| "failed to load route files")?;

    Ok(WorkspaceSnapshot {
        project,
        environments,
        routes,
    })
}

fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> Result<T> {
    let content = fs::read_to_string(path)?;
    let parsed = serde_json::from_str::<T>(&content)?;
    Ok(parsed)
}

fn read_json_dir<T: serde::de::DeserializeOwned>(path: &Path) -> Result<Vec<T>> {
    if !path.exists() {
        return Ok(Vec::new());
    }

    let mut items = Vec::new();
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let file_path = entry.path();
        if file_path.extension().and_then(|ext| ext.to_str()) == Some("json") {
            items.push(read_json(&file_path)?);
        }
    }
    Ok(items)
}
