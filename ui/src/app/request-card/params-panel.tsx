import { TabsContent } from "@/components/ui/tabs"
import { useEffect, useMemo, useState } from "react"
import Editor from "@monaco-editor/react"
import { Input } from "@/components/ui/input"
import { useTheme } from "@/components/theme-provider"
import { Info } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type ParamsPanelProps = {
  queryEntries: Array<[string, string]>
  onQueryEntriesChange: (nextEntries: Array<[string, string]>) => void
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
          normalizedLine.slice(colonIndex + 1).trim().replace(/^"|"$/g, ""),
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

export function ParamsPanel({
  queryEntries,
  onQueryEntriesChange,
}: ParamsPanelProps) {
  const [mode, setMode] = useState<"table" | "bulk">("table")
  const [bulkValue, setBulkValue] = useState("")
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
  const displayedEntries = useMemo<Array<[string, string]>>(
    () => [...queryEntries, ["", ""]],
    [queryEntries]
  )

  useEffect(() => {
    setBulkValue(toBulkText(queryEntries))
  }, [queryEntries])

  function onRowChange(index: number, field: "key" | "value", nextValue: string) {
    const isNewRow = index >= queryEntries.length
    const target = queryEntries[index] ?? ["", ""]
    const nextEntries = isNewRow
      ? nextValue
        ? [
            ...queryEntries,
            (field === "key" ? [nextValue, ""] : ["", nextValue]) as [
              string,
              string,
            ],
          ]
        : queryEntries
      : queryEntries
          .map((entry, entryIndex) => {
            if (entryIndex !== index) return entry
            return (field === "key"
              ? [nextValue, entry[1]]
              : [entry[0], nextValue]) as [string, string]
          })
          .filter((_, entryIndex) => {
            if (entryIndex !== index) return true
            const nextKey = field === "key" ? nextValue : target[0]
            const nextValueForEntry = field === "value" ? nextValue : target[1]
            return nextKey.trim().length > 0 || nextValueForEntry.trim().length > 0
          })
    onQueryEntriesChange(nextEntries)
  }

  return (
    <TabsContent value="params" className="mt-1 flex min-h-0 flex-1 px-2 pb-2">
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md">
        {mode === "table" ? (
          <>
            <div className="min-h-0 flex-1 overflow-auto">
              <Table>
                <TableHeader className="[&_tr]:border-0">
                  <TableRow className="border-0 bg-muted/30 hover:bg-muted/30">
                    <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                      Name
                    </TableHead>
                    <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                      Value
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:last-child]:border-0">
                  {displayedEntries.map(([key, value], index) => (
                    <TableRow
                      key={`param-row-${index}`}
                      className="border-0 odd:bg-muted/10 even:bg-background hover:bg-muted/20"
                    >
                      <TableCell className="px-3 py-2">
                        <Input
                          value={key}
                          onChange={(event) =>
                            onRowChange(index, "key", event.target.value)
                          }
                          className="h-7 rounded-md border-border/50 !bg-transparent font-mono text-xs text-foreground/90"
                          aria-label={`Param name ${index + 1}`}
                          placeholder="Name"
                        />
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <Input
                          value={value}
                          onChange={(event) =>
                            onRowChange(index, "value", event.target.value)
                          }
                          className="h-7 rounded-md border-border/50 !bg-transparent font-mono text-xs text-foreground/80"
                          aria-label={`Param value ${index + 1}`}
                          placeholder="Value"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
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
                onQueryEntriesChange(fromBulkText(next))
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
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Path</span>
            <Info className="size-3.5" />
          </div>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-6 px-0 text-xs"
            onClick={() => setMode((current) => (current === "table" ? "bulk" : "table"))}
          >
            {mode === "table" ? "Bulk Edit" : "Key/Value Edit"}
          </Button>
        </div>
      </div>
    </TabsContent>
  )
}
