import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchEnvironments, fetchRoutes, runRoute, type RouteDefinition } from "./api";

export function App() {
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const routesQuery = useQuery({ queryKey: ["routes"], queryFn: fetchRoutes, refetchInterval: 2000 });
  const envsQuery = useQuery({ queryKey: ["environments"], queryFn: fetchEnvironments, refetchInterval: 2000 });
  const runMutation = useMutation({ mutationFn: runRoute });

  const selectedRoute = useMemo(
    () => routesQuery.data?.find((route) => route.id === selectedRouteId) ?? routesQuery.data?.[0],
    [routesQuery.data, selectedRouteId],
  );

  const activeEnv = envsQuery.data?.[0]?.name ?? "n/a";

  return (
    <main style={{ display: "grid", gridTemplateColumns: "280px 1fr", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <aside style={{ borderRight: "1px solid #ddd", padding: 16 }}>
        <h2>Routepad</h2>
        <p style={{ color: "#666" }}>Read-only API workspace</p>
        <p><strong>Env:</strong> {activeEnv}</p>
        <hr />
        {routesQuery.isLoading && <p>Loading routes...</p>}
        {routesQuery.data?.map((route) => (
          <RouteItem
            key={route.id}
            route={route}
            selected={selectedRoute?.id === route.id}
            onClick={() => setSelectedRouteId(route.id)}
          />
        ))}
      </aside>
      <section style={{ padding: 16 }}>
        <h3>Request Preview</h3>
        {!selectedRoute && <p>No routes found. Run `routepad init` first.</p>}
        {selectedRoute && (
          <>
            <p><strong>ID:</strong> {selectedRoute.id}</p>
            <p><strong>Name:</strong> {selectedRoute.name}</p>
            <p><strong>Method:</strong> {selectedRoute.method}</p>
            <p><strong>Path:</strong> {selectedRoute.path}</p>
            <button
              onClick={() => runMutation.mutate(selectedRoute.id)}
              disabled={runMutation.isPending}
            >
              {runMutation.isPending ? "Running..." : "Run Request"}
            </button>
          </>
        )}

        <hr />
        <h3>Response</h3>
        {!runMutation.data && <p>No run yet.</p>}
        {runMutation.data && (
          <>
            <p><strong>Status:</strong> {runMutation.data.status}</p>
            <p><strong>Time:</strong> {runMutation.data.elapsed_ms} ms</p>
            <pre style={{ background: "#f4f4f4", padding: 12, overflow: "auto" }}>
              {JSON.stringify(runMutation.data.response_body ?? {}, null, 2)}
            </pre>
            <h4>Tests</h4>
            <ul>
              {runMutation.data.test_results.map((result, index) => (
                <li key={index}>
                  {result.passed ? "PASS" : "FAIL"} - {result.message}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}

function RouteItem(props: { route: RouteDefinition; selected: boolean; onClick: () => void }) {
  const { route, selected, onClick } = props;
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        marginBottom: 8,
        border: "1px solid #ddd",
        padding: "8px 10px",
        background: selected ? "#eef6ff" : "white",
        cursor: "pointer",
      }}
    >
      <div style={{ fontWeight: 600 }}>{route.name}</div>
      <div style={{ color: "#444", fontSize: 12 }}>
        {route.method} {route.path}
      </div>
    </button>
  );
}
