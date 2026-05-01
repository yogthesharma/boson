import { TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { ArrowDown, ArrowUp, Trash } from "@phosphor-icons/react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useEffect, useMemo, useRef, useState } from "react"
import Editor from "@monaco-editor/react"
import { useTheme } from "@/components/theme-provider"

type HeadersPanelProps = {
  headers: Array<[string, string]>
  onHeadersChange: (headers: Array<[string, string]>) => void
}

type HeaderRow = {
  key: string
  value: string
  enabled: boolean
}

function toBulkText(entries: Array<[string, string]>): string {
  return entries.map(([key, value]) => `"${key}":"${value}"`).join("\n")
}

function fromBulkText(value: string): Array<[string, string]> {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const normalizedLine = line.replace(/,+$/, "").trim()
      if (!normalizedLine) return null

      // Preferred syntax: "key":"value"
      try {
        const parsed = JSON.parse(`{${normalizedLine}}`) as Record<string, unknown>
        const [firstKey] = Object.keys(parsed)
        if (firstKey !== undefined) {
          return [firstKey, String(parsed[firstKey] ?? "")] as [string, string]
        }
      } catch {
        // Fallbacks below
      }

      // Accept key:value as a relaxed fallback.
      const colonIndex = normalizedLine.indexOf(":")
      if (colonIndex !== -1) {
        return [
          normalizedLine.slice(0, colonIndex).trim().replace(/^"|"$/g, ""),
          normalizedLine
            .slice(colonIndex + 1)
            .trim()
            .replace(/^"|"$/g, ""),
        ] as [string, string]
      }

      // Backward compatibility with older key=value bulk drafts.
      const equalsIndex = normalizedLine.indexOf("=")
      if (equalsIndex !== -1) {
        return [
          normalizedLine.slice(0, equalsIndex).trim(),
          normalizedLine.slice(equalsIndex + 1).trim(),
        ] as [string, string]
      }

      return [normalizedLine, ""] as [string, string]
    })
    .filter((entry): entry is [string, string] => entry !== null)
}

export function HeadersPanel({ headers, onHeadersChange }: HeadersPanelProps) {
  const [mode, setMode] = useState<"table" | "bulk">("table")
  const [bulkValue, setBulkValue] = useState("")
  const [rows, setRows] = useState<HeaderRow[]>(() =>
    headers.map(([key, value]) => ({ key, value, enabled: true }))
  )
  const lastEmittedFingerprintRef = useRef("")
  const { theme } = useTheme()
  const editorTheme = useMemo(() => {
    if (theme === "dark") return "vs-dark"
    if (theme === "light") return "vs"
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "vs-dark"
    }
    return "vs"
  }, [theme])
  const displayedRows = useMemo<HeaderRow[]>(
    () => [...rows, { key: "", value: "", enabled: true }],
    [rows]
  )

  useEffect(() => {
    setBulkValue(toBulkText(headers))
  }, [headers])

  useEffect(() => {
    const incomingFingerprint = JSON.stringify(headers)
    if (incomingFingerprint === lastEmittedFingerprintRef.current) return
    setRows(headers.map(([key, value]) => ({ key, value, enabled: true })))
  }, [headers])

  function emitActiveRows(nextRows: HeaderRow[]) {
    const nextEntries = nextRows
      .filter(
        (row) =>
          row.enabled &&
          (row.key.trim().length > 0 || row.value.trim().length > 0)
      )
      .map((row) => [row.key, row.value] as [string, string])
    lastEmittedFingerprintRef.current = JSON.stringify(nextEntries)
    onHeadersChange(nextEntries)
  }

  function onRowChange(index: number, field: "key" | "value", nextValue: string) {
    const isNewRow = index >= rows.length
    if (isNewRow && nextValue.trim().length === 0) return

    const nextRows = isNewRow
      ? [
          ...rows,
          field === "key"
            ? { key: nextValue, value: "", enabled: true }
            : { key: "", value: nextValue, enabled: true },
        ]
      : rows.map((row, rowIndex) =>
          rowIndex === index ? { ...row, [field]: nextValue } : row
        )
    setRows(nextRows)
    emitActiveRows(nextRows)
  }

  function moveRow(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (index < 0 || targetIndex < 0 || targetIndex >= rows.length) return
    const next = [...rows]
    const current = next[index]
    next[index] = next[targetIndex]
    next[targetIndex] = current
    setRows(next)
    emitActiveRows(next)
  }

  function toggleRow(index: number, enabled: boolean) {
    const nextRows = rows.map((row, rowIndex) =>
      rowIndex === index ? { ...row, enabled } : row
    )
    setRows(nextRows)
    emitActiveRows(nextRows)
  }

  function deleteRow(index: number) {
    if (index < 0 || index >= rows.length) return
    const nextRows = rows.filter((_, rowIndex) => rowIndex !== index)
    setRows(nextRows)
    emitActiveRows(nextRows)
  }

  return (
    <TabsContent value="headers" className="mt-1 flex min-h-0 flex-1 px-2 pb-2">
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md">
        {mode === "table" ? (
          <div className="min-h-0 flex-1 overflow-auto">
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
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_tr:last-child]:border-0">
                {displayedRows.map((row, index) => {
                  const rowHasContent =
                    row.key.trim().length > 0 || row.value.trim().length > 0
                  const isPersistedRow = index < rows.length
                  return (
                    <TableRow
                      key={`header-${index}`}
                      className="border-0 odd:bg-muted/10 even:bg-background hover:bg-muted/20"
                    >
                      <TableCell className="px-3 py-2">
                        {rowHasContent ? (
                          <Switch
                            checked={row.enabled}
                            onCheckedChange={(checked) => toggleRow(index, checked)}
                            aria-label={`Enable header row ${index + 1}`}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <Input
                          value={row.key}
                          onChange={(event) =>
                            onRowChange(index, "key", event.target.value)
                          }
                          className="h-7 rounded-md border-border/50 !bg-transparent font-mono text-xs text-foreground/90"
                          aria-label={`Header name ${index + 1}`}
                          placeholder="Header"
                        />
                        {row.value.trim().length > 0 && row.key.trim().length === 0 && (
                          <p className="pt-1 text-[11px] text-amber-500">
                            Header name is required.
                          </p>
                        )}
                        {/\s/.test(row.key.trim()) && row.key.trim().length > 0 && (
                          <p className="pt-1 text-[11px] text-amber-500">
                            Header names should not include spaces.
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <Input
                          value={row.value}
                          onChange={(event) =>
                            onRowChange(index, "value", event.target.value)
                          }
                          className="h-7 rounded-md border-border/50 !bg-transparent font-mono text-xs text-foreground/80"
                          aria-label={`Header value ${index + 1}`}
                          placeholder="Value"
                        />
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        {isPersistedRow && (
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
                              disabled={index >= rows.length - 1}
                              onClick={() => moveRow(index, "down")}
                            >
                              <ArrowDown className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-rose-400 hover:text-rose-300"
                              onClick={() => deleteRow(index)}
                            >
                              <Trash className="size-3.5" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="boson-json-editor min-h-0 flex-1 overflow-hidden">
            <Editor
              height="100%"
              defaultLanguage="plaintext"
              value={bulkValue}
              theme={editorTheme}
              onChange={(value) => {
                const next = value ?? ""
                setBulkValue(next)
                const nextEntries = fromBulkText(next)
                const nextRows = nextEntries.map(([key, value]) => ({
                  key,
                  value,
                  enabled: true,
                }))
                setRows(nextRows)
                emitActiveRows(nextRows)
              }}
              options={{
                minimap: { enabled: false },
                lineNumbers: "on",
                lineNumbersMinChars: 2,
                lineDecorationsWidth: 0,
                glyphMargin: false,
                folding: false,
                scrollBeyondLastLine: false,
                wordWrap: "off",
                fontSize: 12,
                lineHeight: 20,
                padding: { top: 10, bottom: 10 },
                renderLineHighlight: "none",
              }}
            />
          </div>
        )}
        <div className="flex items-center justify-between px-3 py-2">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-6 px-0 text-xs"
            onClick={() =>
              setMode((current) => (current === "table" ? "bulk" : "table"))
            }
          >
            {mode === "table" ? "Bulk Edit" : "Key/Value Edit"}
          </Button>
        </div>
      </div>
    </TabsContent>
  )
}
