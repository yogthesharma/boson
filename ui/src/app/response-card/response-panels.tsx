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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
      <TabsContent
        value="response"
        className="mt-1 flex min-h-0 flex-1 px-4 pb-2"
      >
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md">
          {!result && !isRunning && (
            <Empty className="h-full border-0 bg-muted/10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Lightning className="size-4" />
                </EmptyMedia>
                <EmptyTitle>No response yet</EmptyTitle>
                <EmptyDescription>
                  Run the selected route to inspect response status, payload,
                  and test results.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {isRunning && (
            <div className="space-y-3 p-3">
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
        </div>
      </TabsContent>

      <TabsContent
        value="headers"
        className="mt-1 flex min-h-0 flex-1 px-4 pb-2"
      >
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md">
          <div className="min-h-0 flex-1 overflow-auto">
            <Table>
              <TableHeader className="[&_tr]:border-0">
                <TableRow className="border-0 bg-muted/30 hover:bg-muted/30">
                  <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>Header</span>
                      <Input
                        value={headerFilter}
                        onChange={(event) => setHeaderFilter(event.target.value)}
                        placeholder="Filter..."
                        className="h-6 w-28 border-border/70 bg-background/70 text-[11px]"
                      />
                    </div>
                  </TableHead>
                  <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
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
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_tr:last-child]:border-0">
                {!result && !isRunning && (
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableCell colSpan={2} className="px-3 py-3 text-sm text-muted-foreground">
                      Run the request to inspect response headers.
                    </TableCell>
                  </TableRow>
                )}
                {isRunning && (
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableCell colSpan={2} className="px-3 py-3">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-10/12" />
                        <Skeleton className="h-4 w-11/12" />
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {result && headerEntries.length === 0 && (
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableCell colSpan={2} className="px-3 py-3 text-sm text-muted-foreground">
                      No response headers were returned.
                    </TableCell>
                  </TableRow>
                )}
                {result && headerEntries.length > 0 && filteredHeaderEntries.length === 0 && (
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableCell colSpan={2} className="px-3 py-3 text-sm text-muted-foreground">
                      No headers match the current filter.
                    </TableCell>
                  </TableRow>
                )}
                {result &&
                  filteredHeaderEntries.map(([name, value]) => (
                    <TableRow
                      key={name}
                      className="border-0 odd:bg-muted/10 even:bg-background hover:bg-muted/20"
                    >
                      <TableCell className="px-3 py-2 font-medium break-all text-foreground/90">
                        {name}
                      </TableCell>
                      <TableCell className="px-3 py-2 break-all text-foreground/80">
                        {value}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </TabsContent>

      <TabsContent
        value="timeline"
        className="mt-1 flex min-h-0 flex-1 px-4 pb-2"
      >
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md">
          <div className="min-h-0 flex-1 overflow-auto">
            <Table>
              <TableHeader className="[&_tr]:border-0">
                <TableRow className="border-0 bg-muted/30 hover:bg-muted/30">
                  <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                    Event
                  </TableHead>
                  <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
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
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_tr:last-child]:border-0">
                {timeline.length === 0 && (
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableCell colSpan={2} className="px-3 py-3 text-sm text-muted-foreground">
                      Run requests to populate timeline history.
                    </TableCell>
                  </TableRow>
                )}
                {timeline.map((item) => (
                  <TableRow
                    key={item.id}
                    className="border-0 odd:bg-muted/10 even:bg-background hover:bg-muted/20"
                  >
                    <TableCell className="px-3 py-2">
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
                          <span className="truncate text-foreground/90">{item.path}</span>
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {item.routeName}
                          {selectedRoute?.id === item.routeId
                            ? " - currently selected"
                            : ""}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2 align-middle text-xs text-muted-foreground">
                      {formatRelativeTime(item.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="tests" className="mt-1 flex min-h-0 flex-1 px-4 pb-2">
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md">
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
            {result && (
              <Table>
                <TableHeader className="[&_tr]:border-0">
                  <TableRow className="border-0 bg-muted/30 hover:bg-muted/30">
                    <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                      Assertion
                    </TableHead>
                    <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                      Result
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:last-child]:border-0">
                  {result.test_results.length === 0 && (
                    <TableRow className="border-0 hover:bg-transparent">
                      <TableCell colSpan={2} className="px-3 py-3 text-sm text-muted-foreground">
                        No tests defined for this route.
                      </TableCell>
                    </TableRow>
                  )}
                  {result.test_results.map((test, index) => (
                    <TableRow
                      key={`${index}-${test.message}`}
                      className="border-0 odd:bg-muted/10 even:bg-background hover:bg-muted/20"
                    >
                      <TableCell className="px-3 py-2 break-words text-foreground/90">
                        {test.message}
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <span
                          className={`inline-flex min-w-14 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            test.passed
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-rose-500/15 text-rose-400"
                          }`}
                        >
                          {test.passed ? "PASS" : "FAIL"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </TabsContent>
    </>
  )
}
