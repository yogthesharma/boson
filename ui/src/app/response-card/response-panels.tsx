import { CopySimple, Lightning } from "@phosphor-icons/react"
import { useMemo, useState } from "react"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { TabsContent } from "@/components/ui/tabs"
import type { RouteDefinition, RunResult } from "@/api"
import type { TimelineEntry } from "./types"
import { JsonCodeView } from "./json-code-view"

type ResponsePanelsProps = {
  result: RunResult | null
  isRunning: boolean
  responseText: string
  timeline: TimelineEntry[]
  selectedRoute?: RouteDefinition
  onClearTimeline: () => void
}

export function ResponsePanels(props: ResponsePanelsProps) {
  const {
    result,
    isRunning,
    responseText,
    timeline,
    selectedRoute,
    onClearTimeline,
  } = props
  const [headerFilter, setHeaderFilter] = useState("")
  const headerEntries = result
    ? Object.entries(result.response_headers ?? {}).sort(([a], [b]) =>
        a.localeCompare(b)
      )
    : []
  const filteredHeaderEntries = useMemo(() => {
    const query = headerFilter.trim().toLowerCase()
    if (!query) return headerEntries
    return headerEntries.filter(([name, value]) =>
      `${name} ${value}`.toLowerCase().includes(query)
    )
  }, [headerEntries, headerFilter])
  const formatRelativeTime = (timestamp: number) => {
    const diff = Math.max(1, Date.now() - timestamp)
    const seconds = Math.floor(diff / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <>
      <TabsContent value="response" className="mt-1.5 flex-1 overflow-hidden">
        {!result && !isRunning && (
          <Empty className="h-full border-muted/50 bg-muted/10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Lightning className="size-4" />
              </EmptyMedia>
              <EmptyTitle>No response yet</EmptyTitle>
              <EmptyDescription>
                Run the selected route to inspect response status, payload, and
                test results.
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
          <div className="h-full overflow-auto rounded-md">
            <JsonCodeView content={responseText} />
          </div>
        )}
      </TabsContent>

      <TabsContent value="headers" className="flex min-h-0 flex-1">
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
          <div className="grid grid-cols-2 border-b border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Header</span>
              <Input
                value={headerFilter}
                onChange={(event) => setHeaderFilter(event.target.value)}
                placeholder="Filter..."
                className="h-6 w-28 border-border/70 bg-background/70 text-[11px]"
              />
            </div>
            <div className="flex items-center justify-between">
              <span>Value</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px]"
                disabled={!result || filteredHeaderEntries.length === 0}
                onClick={() => {
                  const text = filteredHeaderEntries
                    .map(([name, value]) => `${name}: ${value}`)
                    .join("\n")
                  void navigator.clipboard.writeText(text)
                }}
              >
                <CopySimple className="mr-1 size-3" />
                Copy
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {!result && !isRunning && (
              <div className="px-3 py-3 text-sm text-muted-foreground">
                Run the request to inspect response headers.
              </div>
            )}
            {isRunning && (
              <div className="space-y-2 px-3 py-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-10/12" />
                <Skeleton className="h-4 w-11/12" />
              </div>
            )}
            {result && headerEntries.length === 0 && (
              <div className="px-3 py-3 text-sm text-muted-foreground">
                No response headers were returned.
              </div>
            )}
            {result &&
              headerEntries.length > 0 &&
              filteredHeaderEntries.length === 0 && (
                <div className="px-3 py-3 text-sm text-muted-foreground">
                  No headers match the current filter.
                </div>
              )}
            {result &&
              filteredHeaderEntries.map(([name, value]) => (
                <div
                  key={name}
                  className="grid grid-cols-2 border-b border-border/60 px-3 py-2 text-sm last:border-b"
                >
                  <span className="font-medium break-all text-foreground/90">
                    {name}
                  </span>
                  <span className="break-all text-foreground/80">{value}</span>
                </div>
              ))}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="timeline" className="flex min-h-0 flex-1">
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
          <div className="grid grid-cols-2 border-b border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <span>Event</span>
            <div className="flex items-center justify-between">
              <span>Time</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={timeline.length === 0}
                onClick={onClearTimeline}
                className="h-6 px-2 text-[11px]"
              >
                Clear
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {timeline.length === 0 && (
              <p className="px-3 py-3 text-sm text-muted-foreground">
                Run requests to populate timeline history.
              </p>
            )}
            {timeline.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-2 gap-3 border-b border-border/60 px-3 py-2 text-sm last:border-b"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        item.ok
                          ? "font-semibold text-emerald-400"
                          : "font-semibold text-rose-400"
                      }
                    >
                      {item.statusText}
                    </span>
                    <span className="text-xs font-semibold tracking-wide text-emerald-400/90">
                      {item.method}
                    </span>
                    <span className="truncate text-foreground/90">
                      {item.path}
                    </span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {item.routeName}
                    {selectedRoute?.id === item.routeId
                      ? " - currently selected"
                      : ""}
                  </div>
                </div>
                <span className="shrink-0 self-center text-xs text-muted-foreground">
                  {formatRelativeTime(item.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="tests" className="flex min-h-0 flex-1">
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
          <div className="grid grid-cols-2 border-b border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <span>Assertion</span>
            <span>Result</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {!result && !isRunning && (
              <p className="px-3 py-3 text-sm text-muted-foreground">
                Run the request to execute tests.
              </p>
            )}
            {isRunning && (
              <div className="space-y-2 px-3 py-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-10/12" />
              </div>
            )}
            {result && result.test_results.length === 0 && (
              <p className="px-3 py-3 text-sm text-muted-foreground">
                No tests defined for this route.
              </p>
            )}
            {result &&
              result.test_results.map((test, index) => (
                <div
                  key={`${index}-${test.message}`}
                  className="grid grid-cols-2 gap-3 border-b border-border/60 px-3 py-2 text-sm last:border-b"
                >
                  <span className="break-words text-foreground/90">
                    {test.message}
                  </span>
                  <div className="flex items-center justify-start">
                    <span
                      className={`inline-flex min-w-14 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        test.passed
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-rose-500/15 text-rose-400"
                      }`}
                    >
                      {test.passed ? "PASS" : "FAIL"}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </TabsContent>
    </>
  )
}
