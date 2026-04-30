import { useCallback, useEffect, useMemo, useState } from "react"
import { Clock, Lightning } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  getEnvironments,
  getEventsUrl,
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
  const [lastRunByRoute, setLastRunByRoute] = useState<
    Record<string, "passed" | "failed">
  >({})
  const [syncToken, setSyncToken] = useState(0)
  const [sseConnected, setSseConnected] = useState(false)

  const loadWorkspace = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const [routesData, envData] = await Promise.all([
        getRoutes(),
        getEnvironments(),
      ])
      setRoutes(routesData)
      setEnvironments(envData)
      setSyncToken((value) => value + 1)
      setSelectedRouteId((current) => {
        if (current && routesData.some((route) => route.id === current)) {
          return current
        }
        return routesData[0]?.id ?? ""
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspace")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadWorkspace()
  }, [loadWorkspace])

  useEffect(() => {
    const events = new EventSource(getEventsUrl())

    events.onopen = () => setSseConnected(true)
    events.onerror = () => setSseConnected(false)
    events.addEventListener("workspace-updated", () => {
      void loadWorkspace()
    })

    return () => {
      events.close()
    }
  }, [loadWorkspace])

  useEffect(() => {
    if (sseConnected) return
    const timer = window.setInterval(() => {
      void loadWorkspace()
    }, 3000)
    return () => window.clearInterval(timer)
  }, [sseConnected, loadWorkspace])

  const selectedRoute = useMemo(
    () => routes.find((r) => r.id === selectedRouteId) ?? routes[0],
    [routes, selectedRouteId]
  )
  const activeEnvironment = environments[0]?.name ?? "local"

  const executeRoute = async (route: RouteDefinition) => {
    setIsRunning(true)
    setError("")
    try {
      const runResult = await runRoute(route.id)
      setResult(runResult)
      const failed = runResult.test_results.some((test) => !test.passed)
      setLastRunByRoute((current) => ({
        ...current,
        [route.id]: failed ? "failed" : "passed",
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed")
      setLastRunByRoute((current) => ({ ...current, [route.id]: "failed" }))
    } finally {
      setIsRunning(false)
    }
  }

  const handleRun = async () => {
    if (!selectedRoute) return
    await executeRoute(selectedRoute)
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        routes={routes}
        selectedRouteId={selectedRoute?.id}
        onSelectRoute={setSelectedRouteId}
        lastRunByRoute={lastRunByRoute}
        activeEnvironment={activeEnvironment}
        isLoading={isLoading}
        syncToken={syncToken}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex min-w-0 items-center gap-2">
            <p className="text-sm text-muted-foreground">
              Repo-native API workspace
            </p>
            {selectedRoute && (
              <Badge variant="outline">{selectedRoute.method}</Badge>
            )}
            <Badge variant={sseConnected ? "default" : "secondary"}>
              {sseConnected ? "Live" : "Polling"}
            </Badge>
          </div>
        </header>
        <section className="mx-auto w-full max-w-6xl space-y-5 p-6">
          {error && (
            <Card className="border-destructive/40">
              <CardContent className="pt-6 text-sm text-destructive">
                {error}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Request Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pb-6 text-base">
              {!selectedRoute && (
                <p className="text-muted-foreground">
                  Select a route to continue.
                </p>
              )}
              {selectedRoute && (
                <>
                  <div className="grid gap-3 rounded-md border bg-muted/20 p-4 md:grid-cols-2">
                    <MetaRow label="ID" value={selectedRoute.id} />
                    <MetaRow label="Name" value={selectedRoute.name} />
                    <MetaRow label="Method" value={selectedRoute.method} />
                    <MetaRow label="Path" value={selectedRoute.path} />
                  </div>
                  <Button
                    size="default"
                    className="min-w-36 font-medium"
                    onClick={handleRun}
                    disabled={isRunning}
                  >
                    {isRunning ? "Running..." : "Run Request"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Response</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pb-6 text-sm">
              {!result && !isRunning && (
                <Empty className="border-muted/50 bg-muted/10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Lightning className="size-4" />
                    </EmptyMedia>
                    <EmptyTitle>No response yet</EmptyTitle>
                    <EmptyDescription>
                      Run the selected route to inspect response status,
                      payload, and test results.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
              {isRunning && (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-36 w-full" />
                </div>
              )}
              {result && (
                <>
                  <div className="flex items-center gap-3 text-sm">
                    <Badge
                      variant={result.status < 400 ? "default" : "destructive"}
                    >
                      Status {result.status}
                    </Badge>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="size-3.5" />
                      <span>{result.elapsed_ms} ms</span>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 font-medium">Body</p>
                    <pre className="max-h-80 overflow-auto rounded-md border bg-muted p-3 text-xs leading-relaxed">
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

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  )
}
