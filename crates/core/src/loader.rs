use crate::schema::{
    EnvironmentConfig, PresetDefinition, ProjectConfig, RouteDefinition, WorkflowDefinition,
    WorkspaceSnapshot,
};
use anyhow::{Context, Result};
use jsonschema::Validator;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

pub fn load_workspace(root: &Path) -> Result<WorkspaceSnapshot> {
    let api_root = root.join(".api");
    let project: ProjectConfig = read_json(&api_root.join("project.json"))
        .with_context(|| "failed to load .api/project.json")?;

    let environments_dir = api_root.join("environments");
    let presets_dir = api_root.join("presets");
    let workflows_dir = api_root.join("workflows");
    let routes_dir = api_root.join("routes");

    let environments = read_environments_dir(&environments_dir)
        .with_context(|| "failed to load environment files")?;
    let presets = read_presets_dir(&presets_dir).with_context(|| "failed to load preset files")?;
    let workflows =
        read_workflows_dir(&workflows_dir).with_context(|| "failed to load workflow files")?;
    let routes = read_routes_dir(&routes_dir).with_context(|| "failed to load route files")?;

    Ok(WorkspaceSnapshot {
        project,
        environments,
        presets,
        workflows,
        routes,
    })
}

fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> Result<T> {
    let content = fs::read_to_string(path)?;
    let parsed = serde_json::from_str::<T>(&content)?;
    Ok(parsed)
}

fn read_environments_dir(path: &Path) -> Result<Vec<EnvironmentConfig>> {
    if !path.exists() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let file_path = entry.path();
        if file_path.extension().and_then(|ext| ext.to_str()) == Some("json") {
            files.push(file_path);
        }
    }
    files.sort();

    let mut environments = Vec::new();
    for file_path in files {
        let mut environment: EnvironmentConfig = read_json(&file_path)?;
        let rel = file_path
            .strip_prefix(path)
            .unwrap_or(&file_path)
            .to_string_lossy()
            .replace('\\', "/");
        environment.source_path = Some(rel);
        environments.push(environment);
    }
    Ok(environments)
}

fn read_routes_dir(path: &Path) -> Result<Vec<RouteDefinition>> {
    if !path.exists() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    collect_json_files(path, &mut files)?;
    files.sort();

    let schema = route_schema_validator()?;
    let mut items = Vec::new();
    for file_path in files {
        let content = fs::read_to_string(&file_path)?;
        let raw_value: Value = serde_json::from_str(&content)
            .with_context(|| format!("invalid JSON in {}", file_path.display()))?;
        validate_route_value(&schema, &raw_value, &file_path)?;
        let mut route: RouteDefinition = serde_json::from_value(raw_value)
            .with_context(|| format!("failed to parse route {}", file_path.display()))?;
        let rel = file_path
            .strip_prefix(path)
            .unwrap_or(&file_path)
            .to_string_lossy()
            .replace('\\', "/");
        route.source_path = Some(rel);
        items.push(route);
    }
    Ok(items)
}

fn read_presets_dir(path: &Path) -> Result<Vec<PresetDefinition>> {
    if !path.exists() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    collect_json_files(path, &mut files)?;
    files.sort();

    let schema = preset_schema_validator()?;
    let mut items = Vec::new();
    for file_path in files {
        let content = fs::read_to_string(&file_path)?;
        let raw_value: Value = serde_json::from_str(&content)
            .with_context(|| format!("invalid JSON in {}", file_path.display()))?;
        validate_route_value(&schema, &raw_value, &file_path)?;
        let mut preset: PresetDefinition = serde_json::from_value(raw_value)
            .with_context(|| format!("failed to parse preset {}", file_path.display()))?;
        let rel = file_path
            .strip_prefix(path)
            .unwrap_or(&file_path)
            .to_string_lossy()
            .replace('\\', "/");
        preset.source_path = Some(rel);
        items.push(preset);
    }
    Ok(items)
}

fn read_workflows_dir(path: &Path) -> Result<Vec<WorkflowDefinition>> {
    if !path.exists() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    collect_json_files(path, &mut files)?;
    files.sort();

    let schema = workflow_schema_validator()?;
    let mut items = Vec::new();
    for file_path in files {
        let content = fs::read_to_string(&file_path)?;
        let raw_value: Value = serde_json::from_str(&content)
            .with_context(|| format!("invalid JSON in {}", file_path.display()))?;
        validate_route_value(&schema, &raw_value, &file_path)?;
        let mut workflow: WorkflowDefinition = serde_json::from_value(raw_value)
            .with_context(|| format!("failed to parse workflow {}", file_path.display()))?;
        let rel = file_path
            .strip_prefix(path)
            .unwrap_or(&file_path)
            .to_string_lossy()
            .replace('\\', "/");
        workflow.source_path = Some(rel);
        items.push(workflow);
    }
    Ok(items)
}

fn route_schema_validator() -> Result<Validator> {
    let schema: Value = serde_json::from_str(include_str!("route.schema.json"))
        .with_context(|| "invalid embedded route schema")?;
    jsonschema::validator_for(&schema).with_context(|| "failed to compile route schema")
}

fn preset_schema_validator() -> Result<Validator> {
    let schema: Value = serde_json::from_str(include_str!("preset.schema.json"))
        .with_context(|| "invalid embedded preset schema")?;
    jsonschema::validator_for(&schema).with_context(|| "failed to compile preset schema")
}

fn workflow_schema_validator() -> Result<Validator> {
    let schema: Value = serde_json::from_str(include_str!("workflow.schema.json"))
        .with_context(|| "invalid embedded workflow schema")?;
    jsonschema::validator_for(&schema).with_context(|| "failed to compile workflow schema")
}

fn validate_route_value(schema: &Validator, value: &Value, file_path: &Path) -> Result<()> {
    if let Err(error) = schema.validate(value) {
        anyhow::bail!(
            "route schema validation failed for {}: {}",
            file_path.display(),
            error
        );
    }
    Ok(())
}

fn collect_json_files(path: &Path, out: &mut Vec<PathBuf>) -> Result<()> {
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let file_path = entry.path();
        if file_path.is_dir() {
            collect_json_files(&file_path, out)?;
            continue;
        }
        if file_path.extension().and_then(|ext| ext.to_str()) == Some("json") {
            out.push(file_path);
        }
    }
    Ok(())
}
