import { useCallback, useEffect, useMemo, useState } from "react"
import {
  getProject,
  listRuns,
  getEnvironments,
  getEventsUrl,
  getRoutes,
  rerun,
  runRoute,
  type EnvironmentConfig,
  type ProjectConfig,
  type RunRouteOverrides,
  type RouteDefinition,
  type RunResult,
} from "@/api"
import type { TimelineEntry } from "@/app/response-card/types"

const TIMELINE_STORAGE_KEY = "boson.response.timeline.v1"
const ACTIVE_ENVIRONMENT_STORAGE_KEY = "boson.active.environment.v1"

export function useWorkspace() {
  const [project, setProject] = useState<ProjectConfig | null>(null)
  const [routes, setRoutes] = useState<RouteDefinition[]>([])
  const [environments, setEnvironments] = useState<EnvironmentConfig[]>([])
  const [selectedEnvironmentName, setSelectedEnvironmentName] = useState<string>(() => {
    if (typeof window === "undefined") return ""
    return window.localStorage.getItem(ACTIVE_ENVIRONMENT_STORAGE_KEY) ?? ""
  })
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
      const [projectData, routesData, envData, runs] = await Promise.all([
        getProject(),
        getRoutes(),
        getEnvironments(),
        listRuns().catch(() => []),
      ])
      setProject(projectData)
      setRoutes(routesData)
      setEnvironments(envData)
      setSelectedEnvironmentName((current) => {
        if (current && envData.some((environment) => environment.name === current)) {
          return current
        }
        return envData[0]?.name ?? ""
      })
      setSyncToken((value) => value + 1)
      setSelectedRouteId((current) => {
        if (current && routesData.some((route) => route.id === current)) {
          return current
        }
        return routesData[0]?.id ?? ""
      })
      setTimeline((current) => {
        if (current.length > 0) return current
        return runs.slice(0, 200).map((item) => {
          const environment = envData.find((env) => env.name === item.environment_name)
          return {
            id: item.run_id,
            runId: item.run_id,
            routeId: item.route_id,
            routeName: item.route_name,
            environmentName: item.environment_name,
            environmentBaseUrl: environment?.variables?.base_url,
            method: item.method,
            path: item.path,
            statusText: `${item.status} ${item.ok ? "OK" : "Error"}`,
            ok: item.ok,
            createdAt: item.created_at_ms,
          }
        })
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
  const activeEnvironment = selectedEnvironmentName || environments[0]?.name || "local"
  const defaultEnvironmentName = project?.default_environment || environments[0]?.name || ""
  const defaultEnvironmentConfig = useMemo(
    () => environments.find((environment) => environment.name === defaultEnvironmentName),
    [defaultEnvironmentName, environments]
  )
  const activeEnvironmentConfig = useMemo(
    () => environments.find((environment) => environment.name === activeEnvironment),
    [activeEnvironment, environments]
  )
  const activeBaseUrl =
    activeEnvironmentConfig?.variables?.base_url ?? "http://127.0.0.1:8787"
  const activeEnvironmentVariables = activeEnvironmentConfig?.variables ?? {}

  const runSelectedRoute = useCallback(async (overrides?: RunRouteOverrides) => {
    if (!selectedRoute) return
    setIsRunning(true)
    setError("")
    try {
      const runResult = await runRoute(selectedRoute.id, overrides, activeEnvironment)
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
          environmentName: activeEnvironment,
          environmentBaseUrl: activeBaseUrl,
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
          environmentName: activeEnvironment,
          environmentBaseUrl: activeBaseUrl,
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
  }, [selectedRoute, activeBaseUrl, activeEnvironment])

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

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!selectedEnvironmentName) return
    window.localStorage.setItem(ACTIVE_ENVIRONMENT_STORAGE_KEY, selectedEnvironmentName)
  }, [selectedEnvironmentName])

  return {
    routes,
    selectedRoute,
    selectedRouteId,
    setSelectedRouteId,
    activeEnvironment,
    activeBaseUrl,
    activeEnvironmentVariables,
    activeEnvironmentConfig,
    defaultEnvironmentName,
    defaultEnvironmentConfig,
    environments,
    selectedEnvironmentName: activeEnvironment,
    setSelectedEnvironmentName,
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
