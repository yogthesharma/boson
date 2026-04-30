import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
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
  const [syncToken, setSyncToken] = useState(0)

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
        setSyncToken((value) => value + 1)
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
    <SidebarProvider>
      <AppSidebar
        routes={routes}
        selectedRouteId={selectedRoute?.id}
        onSelectRoute={setSelectedRouteId}
        activeEnvironment={activeEnvironment}
        isLoading={isLoading}
        syncToken={syncToken}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex min-w-0 items-center gap-2">
            <p className="text-sm text-muted-foreground">Repo-native API workspace</p>
            {selectedRoute && <Badge variant="outline">{selectedRoute.method}</Badge>}
          </div>
        </header>
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
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
