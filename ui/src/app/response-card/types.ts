import type { RunResult } from "@/api"
import type { RouteDefinition } from "@/api"

export type TimelineEntry = {
  id: string
  runId?: string
  routeId: string
  routeName: string
  method: string
  path: string
  statusText: string
  ok: boolean
  createdAt: number
}

export type ResponseCardProps = {
  result: RunResult | null
  isRunning: boolean
  selectedRoute?: RouteDefinition
  timeline: TimelineEntry[]
  onClearTimeline: () => void
  onRerun: (runId: string) => void
}
