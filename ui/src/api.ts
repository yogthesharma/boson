export type RouteDefinition = {
  id: string
  name: string
  method: string
  path: string
  source_path?: string
  group?: string
  headers: Record<string, string>
  body?: unknown
  body_config?: {
    mode?:
      | "none"
      | "json"
      | "xml"
      | "text"
      | "sparql"
      | "form_urlencoded"
      | "multipart_form"
      | "binary"
    raw?: string
    form_entries?: Array<{ key: string; value?: string }>
    multipart_entries?: Array<{ key: string; value?: string; type?: "text" | "file" }>
    binary_path?: string
  }
  tests: Array<
    | { type: "status"; equals: number }
    | { type: "header_exists"; key: string }
    | { type: "header_equals"; key: string; equals: string }
    | { type: "body_path_exists"; path: string }
    | { type: "body_path_equals"; path: string; equals: unknown }
    | { type: "body_schema"; schema: unknown }
    | { type: "body_path_regex"; path: string; pattern: string }
    | { type: "body_path_contains"; path: string; value: string }
    | { type: "body_path_array_length"; path: string; equals: number }
    | { type: "expression"; expr: string }
    | { type: "response_time_ms"; less_than: number }
  >
  auth?: {
    type?: "none" | "basic" | "bearer" | "api_key"
    basic?: { username?: string; password?: string }
    bearer?: { token?: string }
    api_key?: {
      key?: string
      value?: string
      add_to?: "header" | "query"
    }
  }
  vars?: Array<{ key: string; value: string; enabled?: boolean }>
  script?: { pre_request?: string; post_response?: string }
  docs?: { summary?: string; description?: string }
  file?: {
    mode?: "none" | "binary" | "multipart"
    path?: string
    multipart?: Array<{ key: string; value?: string; type?: "text" | "file" }>
  }
  settings?: {
    timeout_ms?: number
    follow_redirects?: boolean
    retry_count?: number
  }
}

export type RunRouteOverrides = {
  method?: string
  path?: string
  headers?: Record<string, string>
  body?: unknown
  tests?: RouteDefinition["tests"]
  auth?: RouteDefinition["auth"]
  vars?: RouteDefinition["vars"]
}

export type EnvironmentConfig = {
  name: string
  source_path?: string
  variables: Record<string, string>
  secret_keys?: string[]
}

export type ProjectConfig = {
  schema_version: string
  name: string
  default_environment: string
}

export type PresetDefinition = {
  id: string
  name: string
  source_path?: string
  description?: string
  headers?: Record<string, string>
  auth?: RouteDefinition["auth"]
  vars?: RouteDefinition["vars"]
  body_config?: RouteDefinition["body_config"]
  settings?: RouteDefinition["settings"]
}

export type RunResult = {
  run_id: string
  route_id: string
  status: number
  elapsed_ms: number
  response_headers: Record<string, string>
  response_body?: unknown
  test_results: Array<{ passed: boolean; message: string }>
}

export type RunHistorySummary = {
  run_id: string
  route_id: string
  route_name: string
  method: string
  path: string
  environment_name: string
  created_at_ms: number
  status: number
  ok: boolean
}

export type RunHistoryDetail = {
  run_id: string
  route_id: string
  route_name: string
  method: string
  path: string
  created_at_ms: number
  overrides?: RunRouteOverrides
  result: RunResult
}

export type WorkflowDefinition = {
  id: string
  name: string
  source_path?: string
  description?: string
  steps: Array<{
    route_id: string
    name?: string
    vars?: Array<{ key: string; value: string; enabled?: boolean }>
    extract?: Array<{ key: string; path: string }>
  }>
}

export type WorkflowRunDetail = {
  run_id: string
  workflow_id: string
  workflow_name: string
  environment_name: string
  created_at_ms: number
  steps: Array<{ step_name: string; route_id: string; run: RunResult }>
  shared_context: Record<string, string>
}

export type RunArtifact = {
  kind: "route-run"
  run_id: string
  environment_name: string
  created_at_ms: number
  request: unknown
  result: RunResult
}

export type WorkflowRunArtifact = {
  kind: "workflow-run"
  run_id: string
  workflow_id: string
  workflow_name: string
  environment_name: string
  created_at_ms: number
  steps: WorkflowRunDetail["steps"]
  shared_context: Record<string, string>
}

const API_BASE =
  import.meta.env.VITE_BOSON_API_BASE?.trim() || "http://127.0.0.1:8787"

async function readJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  if (!response.ok) {
    const fallback = `Request failed: ${response.status}`
    const contentType = response.headers.get("content-type") ?? ""
    if (contentType.includes("application/json")) {
      const data = (await response.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null
      const message = data?.error || data?.message
      throw new Error(message || fallback)
    }
    const text = await response.text().catch(() => "")
    throw new Error(text.trim() || fallback)
  }
  return response.json() as Promise<T>
}

export function getRoutes(): Promise<RouteDefinition[]> {
  return readJson<RouteDefinition[]>(`${API_BASE}/api/routes`)
}

export function getProject(): Promise<ProjectConfig> {
  return readJson<ProjectConfig>(`${API_BASE}/api/project`)
}

export function getEnvironments(): Promise<EnvironmentConfig[]> {
  return readJson<EnvironmentConfig[]>(`${API_BASE}/api/environments`)
}

export function getPresets(): Promise<PresetDefinition[]> {
  return readJson<PresetDefinition[]>(`${API_BASE}/api/presets`)
}

export function getWorkflows(): Promise<WorkflowDefinition[]> {
  return readJson<WorkflowDefinition[]>(`${API_BASE}/api/workflows`)
}

export function runRoute(
  routeId: string,
  overrides?: RunRouteOverrides,
  environmentName?: string
): Promise<RunResult> {
  const searchParams = new URLSearchParams()
  if (environmentName?.trim()) {
    searchParams.set("environment", environmentName.trim())
  }
  const suffix = searchParams.toString()
  const url = `${API_BASE}/api/run/${routeId}${suffix ? `?${suffix}` : ""}`
  return readJson<RunResult>(url, {
    method: "POST",
    headers: overrides ? { "Content-Type": "application/json" } : undefined,
    body: overrides ? JSON.stringify(overrides) : undefined,
  })
}

export function listRuns(): Promise<RunHistorySummary[]> {
  return readJson<RunHistorySummary[]>(`${API_BASE}/api/runs`)
}

export function getRunDetail(runId: string): Promise<RunHistoryDetail> {
  return readJson<RunHistoryDetail>(`${API_BASE}/api/runs/${runId}`)
}

export function rerun(runId: string): Promise<RunResult> {
  return readJson<RunResult>(`${API_BASE}/api/runs/${runId}/re-run`, {
    method: "POST",
  })
}

export function getRunArtifact(runId: string): Promise<RunArtifact> {
  return readJson<RunArtifact>(`${API_BASE}/api/runs/${runId}/artifact`)
}

export function runWorkflow(
  workflowId: string,
  environmentName?: string
): Promise<WorkflowRunDetail> {
  const searchParams = new URLSearchParams()
  if (environmentName?.trim()) {
    searchParams.set("environment", environmentName.trim())
  }
  const suffix = searchParams.toString()
  const url = `${API_BASE}/api/workflows/${workflowId}/run${suffix ? `?${suffix}` : ""}`
  return readJson<WorkflowRunDetail>(url, { method: "POST" })
}

export function listWorkflowRuns(): Promise<WorkflowRunDetail[]> {
  return readJson<WorkflowRunDetail[]>(`${API_BASE}/api/workflow-runs`)
}

export function getWorkflowRunDetail(runId: string): Promise<WorkflowRunDetail> {
  return readJson<WorkflowRunDetail>(`${API_BASE}/api/workflow-runs/${runId}`)
}

export function getWorkflowRunArtifact(runId: string): Promise<WorkflowRunArtifact> {
  return readJson<WorkflowRunArtifact>(`${API_BASE}/api/workflow-runs/${runId}/artifact`)
}

export function getEventsUrl(): string {
  return `${API_BASE}/api/events`
}
