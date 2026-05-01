import { TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { ArrowDown, ArrowUp } from "@phosphor-icons/react"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useMemo, useState } from "react"
import { normalizeEntryRows } from "./helpers"

type HeadersPanelProps = {
  headers: Array<[string, string]>
  onHeadersChange: (headers: Array<[string, string]>) => void
}

function toBulk(entries: Array<[string, string]>): string {
  return entries.map(([k, v]) => `${k}: ${v}`).join("\n")
}

function fromBulk(value: string): Array<[string, string]> {
  return normalizeEntryRows(
    value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const idx = line.indexOf(":")
        if (idx < 0) return [line, ""] as [string, string]
        return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()] as [
          string,
          string,
        ]
      })
  )
}

export function HeadersPanel({ headers, onHeadersChange }: HeadersPanelProps) {
  const [mode, setMode] = useState<"table" | "bulk">("table")
  const [enabledRows, setEnabledRows] = useState<Record<number, boolean>>({})
  const displayRows = useMemo(() => [...headers, ["", ""] as [string, string]], [headers])

  function onRowChange(index: number, field: "key" | "value", value: string) {
    const isNew = index >= headers.length
    const current = headers[index] ?? ["", ""]
    if (isNew && !value.trim()) return
    const next = isNew
      ? [...headers, (field === "key" ? [value, ""] : ["", value])]
      : headers.map((entry, i) =>
          i === index
            ? (field === "key" ? [value, entry[1]] : [entry[0], value])
            : entry
        )
    const cleaned = normalizeEntryRows(next as Array<[string, string]>)
    onHeadersChange(cleaned)
  }

  function moveRow(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (index < 0 || targetIndex < 0 || targetIndex >= headers.length) return
    const next = [...headers]
    const current = next[index]
    next[index] = next[targetIndex]
    next[targetIndex] = current
    onHeadersChange(next)
  }

  return (
    <TabsContent value="headers" className="mt-1 flex min-h-0 flex-1 px-2 pb-2">
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md">
        <div className="min-h-0 flex-1 overflow-auto">
          {mode === "table" ? (
            <Table>
              <TableHeader className="[&_tr]:border-0">
                <TableRow className="border-0 bg-muted/30 hover:bg-muted/30">
                  <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                    On
                  </TableHead>
                  <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                    Header
                  </TableHead>
                  <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                    Value
                  </TableHead>
                  <TableHead className="h-auto px-3 py-2 text-right text-xs text-muted-foreground">
                    Move
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_tr:last-child]:border-0">
                {displayRows.map(([key, value], index) => (
                  <TableRow
                    key={`header-${index}`}
                    className="border-0 odd:bg-muted/10 even:bg-background hover:bg-muted/20"
                  >
                    <TableCell className="px-3 py-2">
                      <Switch
                        checked={enabledRows[index] ?? true}
                        onCheckedChange={(checked) =>
                          setEnabledRows((current) => ({ ...current, [index]: checked }))
                        }
                        aria-label={`Enable header row ${index + 1}`}
                      />
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <Input
                        value={key}
                        onChange={(event) =>
                          onRowChange(index, "key", event.target.value)
                        }
                        disabled={(enabledRows[index] ?? true) === false}
                        className="h-7 rounded-md border-border/50 !bg-transparent font-mono text-xs"
                        placeholder="Header"
                      />
                      {value.trim().length > 0 && key.trim().length === 0 && (
                        <p className="pt-1 text-[11px] text-amber-500">Header name is required.</p>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <Input
                        value={value}
                        onChange={(event) =>
                          onRowChange(index, "value", event.target.value)
                        }
                        disabled={(enabledRows[index] ?? true) === false}
                        className="h-7 rounded-md border-border/50 !bg-transparent font-mono text-xs"
                        placeholder="Value"
                      />
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      {index < headers.length && (
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            disabled={index === 0}
                            onClick={() => moveRow(index, "up")}
                          >
                            <ArrowUp className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            disabled={index >= headers.length - 1}
                            onClick={() => moveRow(index, "down")}
                          >
                            <ArrowDown className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="px-3 py-2">
              <Textarea
                value={toBulk(headers)}
                onChange={(event) => onHeadersChange(fromBulk(event.target.value))}
                className="min-h-64 font-mono text-xs"
                placeholder="Header-One: value"
              />
            </div>
          )}
        </div>
        <div className="px-3 py-2 text-right">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-6 px-0 text-xs"
            onClick={() => setMode((value) => (value === "table" ? "bulk" : "table"))}
          >
            {mode === "table" ? "Bulk Edit" : "Table Edit"}
          </Button>
        </div>
      </div>
    </TabsContent>
  )
}
