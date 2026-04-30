export type RouteDefinition = {
  id: string
  name: string
  method: string
  path: string
  group?: string
}

export type EnvironmentConfig = {
  name: string
  variables: Record<string, string>
}

export type RunResult = {
  route_id: string
  status: number
  elapsed_ms: number
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

export function runRoute(routeId: string): Promise<RunResult> {
  return readJson<RunResult>(`${API_BASE}/api/run/${routeId}`, {
    method: "POST",
  })
}
