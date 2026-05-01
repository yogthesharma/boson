use crate::schema::{EnvironmentConfig, RouteDefinition, RouteTest};
use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{collections::BTreeMap, time::Instant};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunResult {
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
    _environment: &EnvironmentConfig,
) -> Result<RunResult> {
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

    if let Some(body) = &route.body {
        request = request.json(body);
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
        route_id: route.id.clone(),
        status,
        elapsed_ms,
        response_headers,
        response_body,
        test_results,
    })
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
