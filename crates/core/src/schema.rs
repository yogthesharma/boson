use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectConfig {
    pub schema_version: String,
    pub name: String,
    pub default_environment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentConfig {
    pub name: String,
    #[serde(default)]
    pub variables: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteDefinition {
    pub id: String,
    pub name: String,
    pub method: String,
    pub path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_path: Option<String>,
    #[serde(default)]
    pub group: Option<String>,
    #[serde(default)]
    pub headers: BTreeMap<String, String>,
    #[serde(default)]
    pub body: Option<Value>,
    #[serde(default)]
    pub tests: Vec<RouteTest>,
    #[serde(default)]
    pub auth: Option<RouteAuthConfig>,
    #[serde(default)]
    pub vars: Vec<RouteVar>,
    #[serde(default)]
    pub script: Option<RouteScriptConfig>,
    #[serde(default)]
    pub docs: Option<RouteDocsConfig>,
    #[serde(default)]
    pub file: Option<RouteFileConfig>,
    #[serde(default)]
    pub settings: Option<RouteSettingsConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum RouteTest {
    Status { equals: u16 },
    HeaderExists { key: String },
    HeaderEquals { key: String, equals: String },
    BodyPathExists { path: String },
    BodyPathEquals { path: String, equals: Value },
    ResponseTimeMs { less_than: u64 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteAuthConfig {
    #[serde(default)]
    pub r#type: Option<String>,
    #[serde(default)]
    pub basic: Option<RouteBasicAuth>,
    #[serde(default)]
    pub bearer: Option<RouteBearerAuth>,
    #[serde(default)]
    pub api_key: Option<RouteApiKeyAuth>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteBasicAuth {
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteBearerAuth {
    #[serde(default)]
    pub token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteApiKeyAuth {
    #[serde(default)]
    pub key: Option<String>,
    #[serde(default)]
    pub value: Option<String>,
    #[serde(default)]
    pub add_to: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteVar {
    pub key: String,
    pub value: String,
    #[serde(default)]
    pub enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteScriptConfig {
    #[serde(default)]
    pub pre_request: Option<String>,
    #[serde(default)]
    pub post_response: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteDocsConfig {
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteMultipartField {
    pub key: String,
    #[serde(default)]
    pub value: Option<String>,
    #[serde(default)]
    pub r#type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteFileConfig {
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default)]
    pub multipart: Vec<RouteMultipartField>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteSettingsConfig {
    #[serde(default)]
    pub timeout_ms: Option<u64>,
    #[serde(default)]
    pub follow_redirects: Option<bool>,
    #[serde(default)]
    pub retry_count: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceSnapshot {
    pub project: ProjectConfig,
    pub environments: Vec<EnvironmentConfig>,
    pub routes: Vec<RouteDefinition>,
}
