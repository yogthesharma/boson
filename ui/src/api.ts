export type RouteDefinition = {
  id: string;
  name: string;
  method: string;
  path: string;
  group?: string;
};

export type EnvironmentConfig = {
  name: string;
  variables: Record<string, string>;
};

export type RunResult = {
  route_id: string;
  status: number;
  elapsed_ms: number;
  response_body?: unknown;
  test_results: Array<{ passed: boolean; message: string }>;
};

const API_BASE = "http://127.0.0.1:8787";

export async function fetchRoutes(): Promise<RouteDefinition[]> {
  const response = await fetch(`${API_BASE}/api/routes`);
  if (!response.ok) throw new Error("failed to fetch routes");
  return response.json();
}

export async function fetchEnvironments(): Promise<EnvironmentConfig[]> {
  const response = await fetch(`${API_BASE}/api/environments`);
  if (!response.ok) throw new Error("failed to fetch environments");
  return response.json();
}

export async function runRoute(routeId: string): Promise<RunResult> {
  const response = await fetch(`${API_BASE}/api/run/${routeId}`, { method: "POST" });
  if (!response.ok) throw new Error("route run failed");
  return response.json();
}
