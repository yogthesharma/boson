use crate::schema::{EnvironmentConfig, RouteDefinition, RouteTest};
use anyhow::Result;
use base64::Engine;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{collections::BTreeMap, fs, path::Path, time::Instant};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunResult {
    pub run_id: String,
    pub route_id: String,
    pub status: u16,
    pub elapsed_ms: u128,
    pub response_headers: BTreeMap<String, String>,
    pub response_body: Option<Value>,
    pub test_results: Vec<TestResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResult {
    pub passed: bool,
    pub message: String,
}

pub async fn run_route(
    client: &Client,
    base_url: &str,
    route: &RouteDefinition,
    environment: &EnvironmentConfig,
) -> Result<RunResult> {
    let route = apply_environment_variables_to_route(route, environment);
    let url = if route.path.starts_with("http://") || route.path.starts_with("https://") {
        route.path.clone()
    } else {
        format!("{}{}", base_url.trim_end_matches('/'), route.path.as_str())
    };
    let method = route.method.parse()?;
    let mut request = client.request(method, url);

    for (k, v) in &route.headers {
        request = request.header(k, v);
    }

    if let Some(override_body) = resolve_special_body_from_override(&route)? {
        match override_body {
            ResolvedSpecialBody::Binary { bytes } => {
                request = request.body(bytes);
            }
            ResolvedSpecialBody::Multipart { form } => {
                request = request.multipart(form);
            }
        }
    } else if let Some(config_file_body) = resolve_special_body_from_file_config(&route)? {
        match config_file_body {
            ResolvedSpecialBody::Binary { bytes } => {
                request = request.body(bytes);
            }
            ResolvedSpecialBody::Multipart { form } => {
                request = request.multipart(form);
            }
        }
    } else if let Some(body) = &route.body {
        let content_type = route
            .headers
            .iter()
            .find(|(key, _)| key.eq_ignore_ascii_case("content-type"))
            .map(|(_, value)| value.to_ascii_lowercase())
            .unwrap_or_default();

        if content_type.contains("application/x-www-form-urlencoded") {
            if let Some(object) = body.as_object() {
                let form_map = object
                    .iter()
                    .map(|(key, value)| {
                        let value = value
                            .as_str()
                            .map(ToString::to_string)
                            .unwrap_or_else(|| value.to_string());
                        (key.clone(), value)
                    })
                    .collect::<BTreeMap<String, String>>();
                request = request.form(&form_map);
            } else if let Some(raw) = body.as_str() {
                request = request.body(raw.to_string());
            } else {
                request = request.body(body.to_string());
            }
        } else if content_type.contains("application/json") || content_type.contains("+json") {
            request = request.json(body);
        } else if let Some(raw) = body.as_str() {
            request = request.body(raw.to_string());
        } else {
            request = request.json(body);
        }
    }

    let start = Instant::now();
    let response = request.send().await?;
    let elapsed_ms = start.elapsed().as_millis();
    let status = response.status().as_u16();
    let mut response_headers = BTreeMap::new();
    for (name, value) in response.headers() {
        let key = name.as_str().to_ascii_lowercase();
        let value = value.to_str().unwrap_or_default().to_string();

        response_headers
            .entry(key)
            .and_modify(|existing: &mut String| {
                existing.push_str(", ");
                existing.push_str(&value);
            })
            .or_insert(value);
    }
    let response_body = response.json::<Value>().await.ok();
    let test_results = evaluate_tests(
        status,
        elapsed_ms,
        &response_headers,
        response_body.as_ref(),
        &route.tests,
    );

    Ok(RunResult {
        run_id: String::new(),
        route_id: route.id.clone(),
        status,
        elapsed_ms,
        response_headers,
        response_body,
        test_results,
    })
}

fn apply_environment_variables_to_route(
    route: &RouteDefinition,
    environment: &EnvironmentConfig,
) -> RouteDefinition {
    let mut next = route.clone();
    next.path = replace_tokens(&next.path, &environment.variables);
    next.headers = next
        .headers
        .iter()
        .map(|(key, value)| {
            (
                replace_tokens(key, &environment.variables),
                replace_tokens(value, &environment.variables),
            )
        })
        .collect();

    if let Some(body) = &mut next.body {
        replace_json_tokens_with_map(body, &environment.variables);
    }
    if let Some(file) = &mut next.file {
        if let Some(path) = &mut file.path {
            *path = replace_tokens(path, &environment.variables);
        }
        for field in &mut file.multipart {
            field.key = replace_tokens(&field.key, &environment.variables);
            if let Some(value) = &mut field.value {
                *value = replace_tokens(value, &environment.variables);
            }
        }
    }
    if let Some(body_config) = &mut next.body_config {
        if let Some(raw) = &mut body_config.raw {
            *raw = replace_tokens(raw, &environment.variables);
        }
        if let Some(binary_path) = &mut body_config.binary_path {
            *binary_path = replace_tokens(binary_path, &environment.variables);
        }
        for entry in &mut body_config.form_entries {
            entry.key = replace_tokens(&entry.key, &environment.variables);
            if let Some(value) = &mut entry.value {
                *value = replace_tokens(value, &environment.variables);
            }
        }
        for entry in &mut body_config.multipart_entries {
            entry.key = replace_tokens(&entry.key, &environment.variables);
            if let Some(value) = &mut entry.value {
                *value = replace_tokens(value, &environment.variables);
            }
        }
    }
    next
}

fn replace_tokens(source: &str, values: &BTreeMap<String, String>) -> String {
    let mut output = source.to_string();
    for (key, value) in values {
        output = output.replace(&format!("{{{{{}}}}}", key), value);
    }
    output
}

fn replace_json_tokens_with_map(value: &mut Value, values: &BTreeMap<String, String>) {
    match value {
        Value::String(current) => {
            *current = replace_tokens(current, values);
        }
        Value::Array(items) => {
            for item in items {
                replace_json_tokens_with_map(item, values);
            }
        }
        Value::Object(map) => {
            for item in map.values_mut() {
                replace_json_tokens_with_map(item, values);
            }
        }
        _ => {}
    }
}

fn evaluate_tests(
    status: u16,
    elapsed_ms: u128,
    response_headers: &BTreeMap<String, String>,
    response_body: Option<&Value>,
    tests: &[RouteTest],
) -> Vec<TestResult> {
    tests
        .iter()
        .map(|test| match test {
            RouteTest::Status { equals } => {
                let passed = status == *equals;
                let message = if passed {
                    format!("status == {}", equals)
                } else {
                    format!("expected status {}, got {}", equals, status)
                };

                TestResult { passed, message }
            }
            RouteTest::HeaderExists { key } => {
                let header_key = key.to_ascii_lowercase();
                let passed = response_headers.contains_key(&header_key);
                let message = if passed {
                    format!("header '{}' exists", key)
                } else {
                    format!("expected header '{}' to exist", key)
                };
                TestResult { passed, message }
            }
            RouteTest::HeaderEquals { key, equals } => {
                let header_key = key.to_ascii_lowercase();
                let actual = response_headers.get(&header_key);
                let passed = actual.map(|value| value == equals).unwrap_or(false);
                let message = if passed {
                    format!("header '{}' == '{}'", key, equals)
                } else {
                    format!(
                        "expected header '{}' == '{}', got '{}'",
                        key,
                        equals,
                        actual.cloned().unwrap_or_else(|| "<missing>".to_string())
                    )
                };
                TestResult { passed, message }
            }
            RouteTest::BodyPathExists { path } => {
                let found = response_body.and_then(|body| json_path_get(body, path)).is_some();
                let message = if found {
                    format!("body path '{}' exists", path)
                } else {
                    format!("expected body path '{}' to exist", path)
                };
                TestResult {
                    passed: found,
                    message,
                }
            }
            RouteTest::BodyPathEquals { path, equals } => {
                let actual = response_body.and_then(|body| json_path_get(body, path));
                let passed = actual.map(|value| value == equals).unwrap_or(false);
                let message = if passed {
                    format!("body path '{}' == {}", path, equals)
                } else {
                    format!(
                        "expected body path '{}' == {}, got {}",
                        path,
                        equals,
                        actual
                            .map(ToString::to_string)
                            .unwrap_or_else(|| "<missing>".to_string())
                    )
                };
                TestResult { passed, message }
            }
            RouteTest::ResponseTimeMs { less_than } => {
                let threshold = u128::from(*less_than);
                let passed = elapsed_ms < threshold;
                let message = if passed {
                    format!("response time {}ms < {}ms", elapsed_ms, less_than)
                } else {
                    format!("expected response time < {}ms, got {}ms", less_than, elapsed_ms)
                };
                TestResult { passed, message }
            }
        })
        .collect()
}

fn json_path_get<'a>(value: &'a Value, path: &str) -> Option<&'a Value> {
    let mut current = value;
    let mut tokens = Vec::new();
    let chars: Vec<char> = path.trim().chars().collect();
    let mut index = 0;

    if chars.first() == Some(&'$') {
        index += 1;
    }

    while index < chars.len() {
        match chars[index] {
            '.' => {
                index += 1;
            }
            '[' => {
                index += 1;
                let start = index;
                while index < chars.len() && chars[index].is_ascii_digit() {
                    index += 1;
                }
                if start == index || index >= chars.len() || chars[index] != ']' {
                    return None;
                }
                let parsed = chars[start..index]
                    .iter()
                    .collect::<String>()
                    .parse::<usize>()
                    .ok()?;
                tokens.push(PathToken::Index(parsed));
                index += 1;
            }
            _ => {
                let start = index;
                while index < chars.len() && chars[index] != '.' && chars[index] != '[' {
                    index += 1;
                }
                let key = chars[start..index].iter().collect::<String>();
                if key.is_empty() {
                    return None;
                }
                tokens.push(PathToken::Key(key));
            }
        }
    }

    for token in tokens {
        current = match token {
            PathToken::Key(key) => current.get(&key)?,
            PathToken::Index(pos) => current.get(pos)?,
        };
    }

    Some(current)
}

enum PathToken {
    Key(String),
    Index(usize),
}

enum ResolvedSpecialBody {
    Binary { bytes: Vec<u8> },
    Multipart { form: reqwest::multipart::Form },
}

fn resolve_special_body_from_override(route: &RouteDefinition) -> Result<Option<ResolvedSpecialBody>> {
    let Some(body) = route.body.as_ref() else {
        return Ok(None);
    };
    let Some(envelope) = body.get("__boson_body") else {
        return Ok(None);
    };
    let Some(mode) = envelope.get("mode").and_then(Value::as_str) else {
        return Ok(None);
    };

    if mode == "binary" {
        let file_base64 = envelope.get("file_base64").and_then(Value::as_str).unwrap_or_default();
        if !file_base64.trim().is_empty() {
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(file_base64)
                .map_err(|err| anyhow::anyhow!("invalid binary file_base64 payload: {}", err))?;
            return Ok(Some(ResolvedSpecialBody::Binary { bytes }));
        }
        let path = envelope.get("path").and_then(Value::as_str).unwrap_or_default();
        if !path.trim().is_empty() {
            let bytes = fs::read(path)
                .map_err(|err| anyhow::anyhow!("failed to read binary body file `{}`: {}", path, err))?;
            return Ok(Some(ResolvedSpecialBody::Binary { bytes }));
        }
        return Ok(None);
    }

    if mode == "multipart_form" {
        let mut form = reqwest::multipart::Form::new();
        let entries = envelope
            .get("entries")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        if entries.is_empty() {
            return Ok(None);
        }
        for entry in entries {
            let key = entry.get("key").and_then(Value::as_str).unwrap_or_default().to_string();
            if key.trim().is_empty() {
                continue;
            }
            let entry_type = entry.get("type").and_then(Value::as_str).unwrap_or("text");
            if entry_type == "file" {
                let file_base64 = entry
                    .get("file_base64")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string();
                let file_name = entry
                    .get("file_name")
                    .and_then(Value::as_str)
                    .filter(|value| !value.trim().is_empty())
                    .unwrap_or("upload.bin")
                    .to_string();
                if !file_base64.trim().is_empty() {
                    let bytes = base64::engine::general_purpose::STANDARD
                        .decode(file_base64)
                        .map_err(|err| anyhow::anyhow!("invalid multipart file_base64 payload: {}", err))?;
                    let part = reqwest::multipart::Part::bytes(bytes).file_name(file_name);
                    form = form.part(key, part);
                } else {
                    let file_path = entry
                        .get("value")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string();
                    if file_path.trim().is_empty() {
                        continue;
                    }
                    let bytes = fs::read(&file_path).map_err(|err| {
                        anyhow::anyhow!(
                            "failed to read multipart file `{}` for key `{}`: {}",
                            file_path,
                            key,
                            err
                        )
                    })?;
                    let inferred_name = Path::new(&file_path)
                        .file_name()
                        .and_then(|name| name.to_str())
                        .unwrap_or("upload.bin")
                        .to_string();
                    let part =
                        reqwest::multipart::Part::bytes(bytes).file_name(if file_name == "upload.bin" {
                            inferred_name
                        } else {
                            file_name
                        });
                    form = form.part(key, part);
                }
            } else {
                let value = entry
                    .get("value")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string();
                form = form.text(key, value);
            }
        }
        return Ok(Some(ResolvedSpecialBody::Multipart { form }));
    }

    Ok(None)
}

fn resolve_special_body_from_file_config(
    route: &RouteDefinition,
) -> Result<Option<ResolvedSpecialBody>> {
    let Some(file) = route.file.as_ref() else {
        return Ok(None);
    };
    match file.mode.as_deref() {
        Some("binary") => {
            let Some(path) = file.path.as_deref().filter(|value| !value.trim().is_empty()) else {
                return Ok(None);
            };
            let bytes = fs::read(path)
                .map_err(|err| anyhow::anyhow!("failed to read binary file `{}`: {}", path, err))?;
            Ok(Some(ResolvedSpecialBody::Binary { bytes }))
        }
        Some("multipart") => {
            if file.multipart.is_empty() {
                return Ok(None);
            }
            let mut form = reqwest::multipart::Form::new();
            for field in &file.multipart {
                if field.key.trim().is_empty() {
                    continue;
                }
                if field.r#type.as_deref() == Some("file") {
                    let path = field.value.as_deref().unwrap_or_default();
                    if path.trim().is_empty() {
                        continue;
                    }
                    let bytes = fs::read(path).map_err(|err| {
                        anyhow::anyhow!(
                            "failed to read multipart config file `{}` for key `{}`: {}",
                            path,
                            field.key,
                            err
                        )
                    })?;
                    let filename = Path::new(path)
                        .file_name()
                        .and_then(|value| value.to_str())
                        .unwrap_or("upload.bin")
                        .to_string();
                    let part = reqwest::multipart::Part::bytes(bytes).file_name(filename);
                    form = form.part(field.key.clone(), part);
                } else {
                    form = form.text(field.key.clone(), field.value.clone().unwrap_or_default());
                }
            }
            Ok(Some(ResolvedSpecialBody::Multipart { form }))
        }
        _ => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::{RouteBodyConfig, RouteBodyEntry, RouteFileConfig, RouteMultipartField};

    fn base_route() -> RouteDefinition {
        RouteDefinition {
            id: "id".to_string(),
            name: "name".to_string(),
            method: "POST".to_string(),
            path: "/path".to_string(),
            source_path: None,
            group: None,
            headers: BTreeMap::new(),
            body: None,
            body_config: None,
            tests: Vec::new(),
            auth: None,
            vars: Vec::new(),
            script: None,
            docs: None,
            file: None,
            settings: None,
        }
    }

    #[test]
    fn parses_binary_override_base64() {
        let mut route = base_route();
        route.body = Some(serde_json::json!({
            "__boson_body": {
                "mode": "binary",
                "file_base64": "aGVsbG8="
            }
        }));
        let resolved = resolve_special_body_from_override(&route).expect("parse");
        match resolved {
            Some(ResolvedSpecialBody::Binary { bytes }) => assert_eq!(bytes, b"hello".to_vec()),
            _ => panic!("expected binary body"),
        }
    }

    #[test]
    fn ignores_non_special_override_body() {
        let mut route = base_route();
        route.body = Some(serde_json::json!({"name":"demo"}));
        let resolved = resolve_special_body_from_override(&route).expect("parse");
        assert!(resolved.is_none());
    }

    #[test]
    fn reads_binary_from_file_config_path() {
        let temp_path = std::env::temp_dir().join("boson_binary_test_payload.bin");
        fs::write(&temp_path, b"payload-bytes").expect("write temp file");
        let mut route = base_route();
        route.file = Some(RouteFileConfig {
            mode: Some("binary".to_string()),
            path: Some(temp_path.to_string_lossy().to_string()),
            multipart: Vec::new(),
        });
        let resolved = resolve_special_body_from_file_config(&route).expect("resolve");
        fs::remove_file(&temp_path).ok();
        match resolved {
            Some(ResolvedSpecialBody::Binary { bytes }) => {
                assert_eq!(bytes, b"payload-bytes".to_vec())
            }
            _ => panic!("expected binary body"),
        }
    }

    #[test]
    fn builds_multipart_from_file_config() {
        let mut route = base_route();
        route.file = Some(RouteFileConfig {
            mode: Some("multipart".to_string()),
            path: None,
            multipart: vec![RouteMultipartField {
                key: "title".to_string(),
                value: Some("sample".to_string()),
                r#type: Some("text".to_string()),
            }],
        });
        let resolved = resolve_special_body_from_file_config(&route).expect("resolve");
        assert!(matches!(resolved, Some(ResolvedSpecialBody::Multipart { .. })));
    }

    #[test]
    fn applies_environment_tokens_to_route_fields() {
        let mut route = base_route();
        route.path = "/users/{{tenant}}/items?cursor={{cursor}}".to_string();
        route.headers.insert("x-tenant".to_string(), "{{tenant}}".to_string());
        route.body = Some(serde_json::json!({
            "tenant": "{{tenant}}",
            "nested": { "cursor": "{{cursor}}" }
        }));
        route.body_config = Some(RouteBodyConfig {
            mode: Some("form_urlencoded".to_string()),
            raw: Some("q={{tenant}}".to_string()),
            form_entries: vec![RouteBodyEntry {
                key: "tenant".to_string(),
                value: Some("{{tenant}}".to_string()),
            }],
            multipart_entries: vec![RouteMultipartField {
                key: "meta".to_string(),
                value: Some("{{cursor}}".to_string()),
                r#type: Some("text".to_string()),
            }],
            binary_path: Some("/tmp/{{tenant}}.bin".to_string()),
        });

        let environment = EnvironmentConfig {
            name: "dev".to_string(),
            source_path: None,
            variables: BTreeMap::from([
                ("tenant".to_string(), "acme".to_string()),
                ("cursor".to_string(), "abc".to_string()),
            ]),
            secret_keys: vec![],
        };

        let resolved = apply_environment_variables_to_route(&route, &environment);
        assert!(resolved.path.contains("/users/acme/items"));
        assert_eq!(
            resolved.headers.get("x-tenant").cloned().unwrap_or_default(),
            "acme"
        );
        assert_eq!(
            resolved
                .body
                .as_ref()
                .and_then(|body| body.get("tenant"))
                .and_then(Value::as_str)
                .unwrap_or_default(),
            "acme"
        );
        assert_eq!(
            resolved
                .body_config
                .as_ref()
                .and_then(|config| config.form_entries.first())
                .and_then(|entry| entry.value.as_deref())
                .unwrap_or_default(),
            "acme"
        );
    }

    #[test]
    fn switches_values_between_environments() {
        let mut route = base_route();
        route.path = "/users/{{tenant}}".to_string();

        let env_a = EnvironmentConfig {
            name: "dev".to_string(),
            source_path: None,
            variables: BTreeMap::from([("tenant".to_string(), "team-a".to_string())]),
            secret_keys: vec![],
        };
        let env_b = EnvironmentConfig {
            name: "staging".to_string(),
            source_path: None,
            variables: BTreeMap::from([("tenant".to_string(), "team-b".to_string())]),
            secret_keys: vec![],
        };

        let route_a = apply_environment_variables_to_route(&route, &env_a);
        let route_b = apply_environment_variables_to_route(&route, &env_b);
        assert_eq!(route_a.path, "/users/team-a");
        assert_eq!(route_b.path, "/users/team-b");
    }
}
