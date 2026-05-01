export type RouteDefinition = {
  id: string
  name: string
  method: string
  path: string
  source_path?: string
  group?: string
  headers: Record<string, string>
  body?: unknown
  tests: Array<
    | { type: "status"; equals: number }
    | { type: "header_exists"; key: string }
    | { type: "header_equals"; key: string; equals: string }
    | { type: "body_path_exists"; path: string }
    | { type: "body_path_equals"; path: string; equals: unknown }
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
  variables: Record<string, string>
}

export type RunResult = {
  route_id: string
  status: number
  elapsed_ms: number
  response_headers: Record<string, string>
  response_body?: unknown
  test_results: Array<{ passed: boolean; message: string }>
}

const API_BASE =
  import.meta.env.VITE_BOSON_API_BASE?.trim() || "http://127.0.0.1:8787"

async function readJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function getRoutes(): Promise<RouteDefinition[]> {
  return readJson<RouteDefinition[]>(`${API_BASE}/api/routes`)
}

export function getEnvironments(): Promise<EnvironmentConfig[]> {
  return readJson<EnvironmentConfig[]>(`${API_BASE}/api/environments`)
}

export function runRoute(
  routeId: string,
  overrides?: RunRouteOverrides
): Promise<RunResult> {
  return readJson<RunResult>(`${API_BASE}/api/run/${routeId}`, {
    method: "POST",
    headers: overrides ? { "Content-Type": "application/json" } : undefined,
    body: overrides ? JSON.stringify(overrides) : undefined,
  })
}

export function getEventsUrl(): string {
  return `${API_BASE}/api/events`
}
