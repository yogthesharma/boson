import { useCallback, useEffect, useMemo, useState } from "react"
import {
  listRuns,
  getEnvironments,
  getEventsUrl,
  getRoutes,
  rerun,
  runRoute,
  type EnvironmentConfig,
  type RunRouteOverrides,
  type RouteDefinition,
  type RunResult,
} from "@/api"
import type { TimelineEntry } from "@/app/response-card/types"

const TIMELINE_STORAGE_KEY = "boson.response.timeline.v1"

export function useWorkspace() {
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
  const [timeline, setTimeline] = useState<TimelineEntry[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const raw = window.localStorage.getItem(TIMELINE_STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw) as TimelineEntry[]
      return Array.isArray(parsed) ? parsed.slice(0, 200) : []
    } catch {
      return []
    }
  })

  const loadWorkspace = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const [routesData, envData, runs] = await Promise.all([
        getRoutes(),
        getEnvironments(),
        listRuns().catch(() => []),
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
      setTimeline((current) => {
        if (current.length > 0) return current
        return runs.slice(0, 200).map((item) => ({
          id: item.run_id,
          runId: item.run_id,
          routeId: item.route_id,
          routeName: item.route_name,
          method: item.method,
          path: item.path,
          statusText: `${item.status} ${item.ok ? "OK" : "Error"}`,
          ok: item.ok,
          createdAt: item.created_at_ms,
        }))
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
    return () => events.close()
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
  const activeBaseUrl = environments[0]?.variables?.base_url ?? "http://127.0.0.1:8787"

  const runSelectedRoute = useCallback(async (overrides?: RunRouteOverrides) => {
    if (!selectedRoute) return
    setIsRunning(true)
    setError("")
    try {
      const runResult = await runRoute(selectedRoute.id, overrides)
      setResult(runResult)
      const effectivePath = overrides?.path ?? selectedRoute.path
      const effectiveMethod = (overrides?.method ?? selectedRoute.method).toUpperCase()
      const requestUrl = effectivePath.startsWith("http")
        ? effectivePath
        : `${activeBaseUrl.replace(/\/$/, "")}${effectivePath}`
      setTimeline((current) => [
        {
          id: crypto.randomUUID(),
          runId: runResult.run_id,
          routeId: selectedRoute.id,
          routeName: selectedRoute.name,
          method: effectiveMethod,
          path: requestUrl,
          statusText: `${runResult.status} ${runResult.status < 400 ? "OK" : "Error"}`,
          ok: runResult.status < 400,
          createdAt: Date.now(),
        },
        ...current,
      ])
      const failed = runResult.test_results.some((test) => !test.passed)
      setLastRunByRoute((current) => ({
        ...current,
        [selectedRoute.id]: failed ? "failed" : "passed",
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed")
      const effectivePath = overrides?.path ?? selectedRoute.path
      const effectiveMethod = (overrides?.method ?? selectedRoute.method).toUpperCase()
      const requestUrl = effectivePath.startsWith("http")
        ? effectivePath
        : `${activeBaseUrl.replace(/\/$/, "")}${effectivePath}`
      setTimeline((current) => [
        {
          id: crypto.randomUUID(),
          routeId: selectedRoute.id,
          routeName: selectedRoute.name,
          method: effectiveMethod,
          path: requestUrl,
          statusText: "RUN_FAILED",
          ok: false,
          createdAt: Date.now(),
        },
        ...current,
      ])
      setLastRunByRoute((current) => ({ ...current, [selectedRoute.id]: "failed" }))
    } finally {
      setIsRunning(false)
    }
  }, [selectedRoute, activeBaseUrl])

  const rerunById = useCallback(async (runId: string) => {
    setIsRunning(true)
    setError("")
    try {
      const runResult = await rerun(runId)
      setResult(runResult)
      setTimeline((current) =>
        current.map((entry) =>
          entry.runId === runId
            ? {
                ...entry,
                statusText: `${runResult.status} ${runResult.status < 400 ? "OK" : "Error"}`,
                ok: runResult.status < 400,
              }
            : entry
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-run failed")
    } finally {
      setIsRunning(false)
    }
  }, [])

  const clearTimeline = useCallback(() => {
    setTimeline([])
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(TIMELINE_STORAGE_KEY, JSON.stringify(timeline))
  }, [timeline])

  return {
    routes,
    selectedRoute,
    selectedRouteId,
    setSelectedRouteId,
    activeEnvironment,
    isLoading,
    isRunning,
    error,
    result,
    lastRunByRoute,
    syncToken,
    sseConnected,
    timeline,
    clearTimeline,
    runSelectedRoute,
    rerunById,
  }
}
