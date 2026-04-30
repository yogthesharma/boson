use crate::schema::{EnvironmentConfig, RouteDefinition, RouteTest};
use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Instant;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunResult {
    pub route_id: String,
    pub status: u16,
    pub elapsed_ms: u128,
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
    let url = format!("{}{}", base_url.trim_end_matches('/'), route.path.as_str());
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
    let response_body = response.json::<Value>().await.ok();
    let test_results = evaluate_tests(status, &route.tests);

    Ok(RunResult {
        route_id: route.id.clone(),
        status,
        elapsed_ms,
        response_body,
        test_results,
    })
}

fn evaluate_tests(status: u16, tests: &[RouteTest]) -> Vec<TestResult> {
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
        })
        .collect()
}
