import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  getEnvironments,
  getRoutes,
  runRoute,
  type EnvironmentConfig,
  type RouteDefinition,
  type RunResult,
} from "@/api"

export function App() {
  const [routes, setRoutes] = useState<RouteDefinition[]>([])
  const [environments, setEnvironments] = useState<EnvironmentConfig[]>([])
  const [selectedRouteId, setSelectedRouteId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string>("")
  const [result, setResult] = useState<RunResult | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setIsLoading(true)
      setError("")
      try {
        const [routesData, envData] = await Promise.all([
          getRoutes(),
          getEnvironments(),
        ])
        if (!mounted) return
        setRoutes(routesData)
        setEnvironments(envData)
        if (routesData.length > 0 && !selectedRouteId) {
          setSelectedRouteId(routesData[0].id)
        }
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : "Failed to load workspace")
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    load()
    const timer = window.setInterval(load, 2500)
    return () => {
      mounted = false
      window.clearInterval(timer)
    }
  }, [selectedRouteId])

  const selectedRoute = useMemo(
    () => routes.find((r) => r.id === selectedRouteId) ?? routes[0],
    [routes, selectedRouteId]
  )

  const activeEnvironment = environments[0]?.name ?? "n/a"

  const handleRun = async () => {
    if (!selectedRoute) return
    setIsRunning(true)
    setError("")
    try {
      const runResult = await runRoute(selectedRoute.id)
      setResult(runResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed")
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <main className="grid min-h-svh grid-cols-[300px_1fr] bg-background text-foreground">
      <aside className="border-r p-4">
        <div className="mb-4">
          <h1 className="text-xl font-semibold">Boson</h1>
          <p className="text-sm text-muted-foreground">
            Repo-native API workspace
          </p>
          <div className="mt-2 text-xs text-muted-foreground">
            Environment: <span className="font-medium">{activeEnvironment}</span>
          </div>
        </div>
        <Separator />
        <div className="mt-4 space-y-2">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading routes...</p>
          )}
          {!isLoading && routes.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No routes found. Run <code>boson init</code>.
            </p>
          )}
          {routes.map((route) => (
            <button
              key={route.id}
              onClick={() => setSelectedRouteId(route.id)}
              className={`w-full rounded-md border p-3 text-left transition hover:bg-accent ${
                selectedRoute?.id === route.id ? "bg-accent" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{route.name}</span>
                <Badge variant="secondary">{route.method}</Badge>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {route.path}
              </p>
            </button>
          ))}
        </div>
      </aside>

      <section className="space-y-4 p-6">
        {error && (
          <Card className="border-destructive/40">
            <CardContent className="pt-6 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Request Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!selectedRoute && (
              <p className="text-muted-foreground">Select a route to continue.</p>
            )}
            {selectedRoute && (
              <>
                <p>
                  <span className="font-medium">ID:</span> {selectedRoute.id}
                </p>
                <p>
                  <span className="font-medium">Name:</span> {selectedRoute.name}
                </p>
                <p>
                  <span className="font-medium">Method:</span>{" "}
                  {selectedRoute.method}
                </p>
                <p>
                  <span className="font-medium">Path:</span> {selectedRoute.path}
                </p>
                <Button onClick={handleRun} disabled={isRunning}>
                  {isRunning ? "Running..." : "Run Request"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Response</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!result && (
              <p className="text-muted-foreground">No request executed yet.</p>
            )}
            {result && (
              <>
                <p>
                  <span className="font-medium">Status:</span> {result.status}
                </p>
                <p>
                  <span className="font-medium">Time:</span> {result.elapsed_ms} ms
                </p>
                <div>
                  <p className="mb-1 font-medium">Body</p>
                  <pre className="max-h-72 overflow-auto rounded-md border bg-muted p-3 text-xs">
                    {JSON.stringify(result.response_body ?? {}, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="mb-1 font-medium">Tests</p>
                  <ul className="space-y-1">
                    {result.test_results.map((test, index) => (
                      <li key={index}>
                        {test.passed ? "PASS" : "FAIL"} - {test.message}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  )
}

export default App
