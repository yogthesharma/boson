import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { RouteDefinition } from "@/api"

type RequestPreviewCardProps = {
  selectedRoute?: RouteDefinition
  isRunning: boolean
  onRun: () => void
}

export function RequestPreviewCard(props: RequestPreviewCardProps) {
  const { selectedRoute, isRunning, onRun } = props
  const headers = Object.entries(selectedRoute?.headers ?? {})
  const bodyPreview = selectedRoute?.body
    ? JSON.stringify(selectedRoute.body, null, 2)
    : ""

  return (
    <section className="h-full space-y-4 px-4">
      {!selectedRoute && (
        <p className="text-muted-foreground">Select a route to continue.</p>
      )}
      {selectedRoute && (
        <>
          <div className="flex items-center gap-2 rounded-md border bg-background p-1">
            <Select value={selectedRoute.method.toUpperCase()}>
              <SelectTrigger
                className={`h-9 w-32 rounded-none border-0 !bg-transparent font-semibold shadow-none focus:ring-0 focus-visible:ring-0 ${methodTextClass(
                  selectedRoute.method
                )}`}
                aria-label="HTTP method"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHOD_OPTIONS.map((method) => (
                  <SelectItem
                    key={method}
                    value={method}
                    className={methodTextClass(method)}
                  >
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="h-5 w-px bg-border" />
            <Input
              readOnly
              value={selectedRoute.path}
              className="h-9 border-0 !bg-transparent font-mono text-sm shadow-none focus-visible:ring-0"
            />
            <Button
              size="default"
              className="h-9 min-w-24 px-4 font-medium"
              onClick={onRun}
              disabled={isRunning}
            >
              {isRunning ? "Sending..." : "Send"}
            </Button>
          </div>

          <Tabs defaultValue="params" className="w-full">
            <TabsList
              variant="line"
              className="h-auto w-full justify-start border-b p-0"
            >
              <TabsTrigger value="params">Params</TabsTrigger>
              <TabsTrigger value="headers">
                Headers ({headers.length})
              </TabsTrigger>
              <TabsTrigger value="body">Body</TabsTrigger>
              <TabsTrigger value="tests">
                Tests ({selectedRoute.tests.length})
              </TabsTrigger>
              <TabsTrigger value="meta">Meta</TabsTrigger>
            </TabsList>

            <TabsContent value="params" className="mt-3">
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Key</th>
                      <th className="px-3 py-2 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extractQueryEntries(selectedRoute.path).length === 0 && (
                      <tr>
                        <td
                          colSpan={2}
                          className="px-3 py-3 text-muted-foreground"
                        >
                          No query params in path.
                        </td>
                      </tr>
                    )}
                    {extractQueryEntries(selectedRoute.path).map(
                      ([key, value]) => (
                        <tr key={`${key}-${value}`} className="border-t">
                          <td className="px-3 py-2 font-mono text-xs">{key}</td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {value}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="headers" className="mt-3">
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Header</th>
                      <th className="px-3 py-2 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headers.length === 0 && (
                      <tr>
                        <td
                          colSpan={2}
                          className="px-3 py-3 text-muted-foreground"
                        >
                          No custom headers.
                        </td>
                      </tr>
                    )}
                    {headers.map(([key, value]) => (
                      <tr key={key} className="border-t">
                        <td className="px-3 py-2 font-mono text-xs">{key}</td>
                        <td className="px-3 py-2 font-mono text-xs">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="body" className="mt-3">
              <pre className="max-h-64 overflow-auto rounded-md border bg-muted/20 p-3 text-xs leading-relaxed">
                {bodyPreview || "// No body configured for this route"}
              </pre>
            </TabsContent>

            <TabsContent value="tests" className="mt-3">
              <div className="space-y-2">
                {selectedRoute.tests.map((test, index) => (
                  <div
                    key={index}
                    className="rounded-md border px-3 py-2 text-sm"
                  >
                    <Badge variant="secondary" className="mr-2">
                      {formatTestType(test.type)}
                    </Badge>
                    {describeTest(test)}
                  </div>
                ))}
                {selectedRoute.tests.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No tests defined.
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="meta" className="mt-3">
              <div className="grid gap-3 rounded-md border bg-muted/10 p-4 md:grid-cols-2">
                <MetaRow label="ID" value={selectedRoute.id} />
                <MetaRow label="Name" value={selectedRoute.name} />
                <MetaRow label="Method" value={selectedRoute.method} />
                <MetaRow label="Path" value={selectedRoute.path} />
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </section>
  )
}

function formatTestType(type: RouteDefinition["tests"][number]["type"]) {
  return type.replaceAll("_", " ")
}

function describeTest(test: RouteDefinition["tests"][number]) {
  if (test.type === "status") {
    return (
      <>
        expects <span className="font-mono">{test.equals}</span>
      </>
    )
  }
  if (test.type === "header_exists") {
    return (
      <>
        expects header <span className="font-mono">{test.key}</span> to exist
      </>
    )
  }
  if (test.type === "header_equals") {
    return (
      <>
        expects header <span className="font-mono">{test.key}</span> ={" "}
        <span className="font-mono">{test.equals}</span>
      </>
    )
  }
  if (test.type === "body_path_exists") {
    return (
      <>
        expects body path <span className="font-mono">{test.path}</span> to exist
      </>
    )
  }
  if (test.type === "body_path_equals") {
    return (
      <>
        expects body path <span className="font-mono">{test.path}</span> ={" "}
        <span className="font-mono">{JSON.stringify(test.equals)}</span>
      </>
    )
  }
  return (
    <>
      expects response time {"< "}
      <span className="font-mono">{test.less_than}ms</span>
    </>
  )
}

const METHOD_OPTIONS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const

function methodTextClass(method: string) {
  const upper = method.toUpperCase()
  if (upper === "GET") return "text-emerald-400"
  if (upper === "POST") return "text-sky-400"
  if (upper === "PUT" || upper === "PATCH") return "text-amber-400"
  if (upper === "DELETE") return "text-rose-400"
  return "text-muted-foreground"
}

function extractQueryEntries(path: string): Array<[string, string]> {
  const [_, query = ""] = path.split("?")
  if (!query) return []
  return query
    .split("&")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((pair) => {
      const [key, value = ""] = pair.split("=")
      return [decodeURIComponent(key), decodeURIComponent(value)] as [
        string,
        string,
      ]
    })
}

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
