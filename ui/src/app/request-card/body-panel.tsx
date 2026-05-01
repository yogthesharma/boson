import { TabsContent } from "@/components/ui/tabs"
import { useMemo } from "react"
import Editor from "@monaco-editor/react"
import { useTheme } from "@/components/theme-provider"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Trash } from "@phosphor-icons/react"
import type { MultipartField, RequestBodyMode } from "./helpers"

type BodyPanelProps = {
  bodyMode: RequestBodyMode
  bodyText: string
  bodyFormEntries: Array<[string, string]>
  bodyMultipartEntries: MultipartField[]
  bodyBinaryPath: string
  bodyBinaryFileName: string
  onBodyModeChange: (mode: RequestBodyMode) => void
  onBodyChange: (value: string) => void
  onBodyFormEntriesChange: (entries: Array<[string, string]>) => void
  onBodyMultipartEntriesChange: (entries: MultipartField[]) => void
  onBodyBinaryPathChange: (path: string) => void
  onBodyBinaryFileSelect: (payload: { fileName: string; fileBase64: string }) => void
  onBodyBinaryClear: () => void
}

const BODY_MODE_OPTIONS: Array<{ value: RequestBodyMode; label: string }> = [
  { value: "multipart_form", label: "Multipart Form" },
  { value: "form_urlencoded", label: "Form URL Encoded" },
  { value: "json", label: "JSON" },
  { value: "xml", label: "XML" },
  { value: "text", label: "Text" },
  { value: "sparql", label: "SPARQL" },
  { value: "binary", label: "File / Binary" },
  { value: "none", label: "No Body" },
]

function defaultBodyTemplate(mode: RequestBodyMode): string {
  if (mode === "json") return '{\n  "example": true\n}'
  if (mode === "xml") return "<root>\n  <example>true</example>\n</root>"
  if (mode === "text") return "Plain text body"
  if (mode === "sparql") return "SELECT * WHERE { ?s ?p ?o } LIMIT 10"
  if (mode === "form_urlencoded") return "key=value\nanother=value2"
  if (mode === "multipart_form") return "field=value\nfile=@/path/to/file"
  if (mode === "binary") return "/path/to/file.bin"
  return ""
}

function languageForMode(mode: RequestBodyMode): string {
  if (mode === "json") return "json"
  // Monaco's html grammar gives richer XML-like token highlighting in our setup.
  if (mode === "xml") return "html"
  if (mode === "sparql") return "sparql"
  return "plaintext"
}

export function BodyPanel({
  bodyMode,
  bodyText,
  bodyFormEntries,
  bodyMultipartEntries,
  bodyBinaryPath,
  bodyBinaryFileName,
  onBodyModeChange,
  onBodyChange,
  onBodyFormEntriesChange,
  onBodyMultipartEntriesChange,
  onBodyBinaryPathChange,
  onBodyBinaryFileSelect,
  onBodyBinaryClear,
}: BodyPanelProps) {
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
  const formRows = [...bodyFormEntries, ["", ""] as [string, string]]
  const multipartRows = [
    ...bodyMultipartEntries,
    { key: "", value: "", type: "text" as const },
  ]

  function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result !== "string") {
          reject(new Error("Unable to read file"))
          return
        }
        resolve(reader.result.split(",")[1] ?? "")
      }
      reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"))
      reader.readAsDataURL(file)
    })
  }

  return (
    <TabsContent
      value="body"
      className="mt-1 flex min-h-0 flex-1 !bg-transparent px-2 pb-2"
    >
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden !bg-transparent">
        <div className="flex items-center justify-between !bg-transparent px-1 py-1">
          <div className="text-xs font-medium text-muted-foreground">
            Body Type
          </div>
          <Select
            value={bodyMode}
            onValueChange={(value) => {
              const nextMode = value as RequestBodyMode
              onBodyModeChange(nextMode)
              if (!bodyText.trim()) {
                onBodyChange(defaultBodyTemplate(nextMode))
              }
            }}
          >
            <SelectTrigger className="h-8 w-56 border-border/60 !bg-transparent text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BODY_MODE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden !bg-transparent px-1">
          {bodyMode === "none" ? (
            <div className="flex h-full items-center justify-center !bg-transparent text-sm text-muted-foreground">
              No request body for this draft.
            </div>
          ) : bodyMode === "form_urlencoded" ? (
            <div className="h-full min-h-0 flex-1 overflow-auto !bg-transparent">
              <Table>
                <TableHeader className="[&_tr]:border-0">
                  <TableRow className="border-0 bg-muted/30 hover:bg-muted/30">
                    <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                      Key
                    </TableHead>
                    <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                      Value
                    </TableHead>
                    <TableHead className="h-auto px-3 py-2 text-right text-xs text-muted-foreground">
                      Delete
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:last-child]:border-0">
                  {formRows.map(([key, value], index) => {
                    const isNew = index >= bodyFormEntries.length
                    return (
                      <TableRow
                        key={`body-form-${index}`}
                        className="border-0 odd:bg-muted/10 even:bg-background hover:bg-muted/20"
                      >
                        <TableCell className="px-3 py-2">
                          <Input
                            value={key}
                            onChange={(event) => {
                              const nextValue = event.target.value
                              if (isNew && !nextValue.trim()) return
                              const next = isNew
                                ? [
                                    ...bodyFormEntries,
                                    [nextValue, ""] as [string, string],
                                  ]
                                : bodyFormEntries.map((item, rowIndex) =>
                                    rowIndex === index
                                      ? ([nextValue, item[1]] as [
                                          string,
                                          string,
                                        ])
                                      : item
                                  )
                              onBodyFormEntriesChange(next)
                            }}
                            className="h-7 rounded-md border-border/50 !bg-transparent font-mono text-xs"
                            placeholder="key"
                          />
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <Input
                            value={value}
                            onChange={(event) => {
                              const nextValue = event.target.value
                              if (isNew && !nextValue.trim()) return
                              const next = isNew
                                ? [
                                    ...bodyFormEntries,
                                    ["", nextValue] as [string, string],
                                  ]
                                : bodyFormEntries.map((item, rowIndex) =>
                                    rowIndex === index
                                      ? ([item[0], nextValue] as [
                                          string,
                                          string,
                                        ])
                                      : item
                                  )
                              onBodyFormEntriesChange(next)
                            }}
                            className="h-7 rounded-md border-border/50 !bg-transparent font-mono text-xs"
                            placeholder="value"
                          />
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right">
                          {!isNew && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-rose-400 hover:text-rose-300"
                              onClick={() =>
                                onBodyFormEntriesChange(
                                  bodyFormEntries.filter(
                                    (_, rowIndex) => rowIndex !== index
                                  )
                                )
                              }
                            >
                              <Trash className="size-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : bodyMode === "multipart_form" ? (
            <div className="h-full min-h-0 flex-1 overflow-auto !bg-transparent">
              <Table>
                <TableHeader className="[&_tr]:border-0">
                  <TableRow className="border-0 bg-muted/30 hover:bg-muted/30">
                    <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                      Field
                    </TableHead>
                    <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                      Value
                    </TableHead>
                    <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                      Type
                    </TableHead>
                    <TableHead className="h-auto px-3 py-2 text-right text-xs text-muted-foreground">
                      Delete
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:last-child]:border-0">
                  {multipartRows.map((row, index) => {
                    const isNew = index >= bodyMultipartEntries.length
                    return (
                      <TableRow
                        key={`body-multipart-${index}`}
                        className="border-0 odd:bg-muted/10 even:bg-background hover:bg-muted/20"
                      >
                        <TableCell className="px-3 py-2">
                          <Input
                            value={row.key}
                            onChange={(event) => {
                              const nextValue = event.target.value
                              if (isNew && !nextValue.trim()) return
                              const next = isNew
                                ? [
                                    ...bodyMultipartEntries,
                                    {
                                      key: nextValue,
                                      value: "",
                                      type: "text" as const,
                                    },
                                  ]
                                : bodyMultipartEntries.map((item, rowIndex) =>
                                    rowIndex === index
                                      ? { ...item, key: nextValue }
                                      : item
                                  )
                              onBodyMultipartEntriesChange(next)
                            }}
                            className="h-7 rounded-md border-border/50 !bg-transparent font-mono text-xs"
                            placeholder="field"
                          />
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          {row.type === "file" ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="file"
                                onChange={(event) => {
                                  const file = event.target.files?.[0]
                                  if (!file) return
                                  void readFileAsBase64(file).then((fileBase64) => {
                                    const fileName = file.name
                                    if (isNew && !fileName.trim()) return
                                    const next = isNew
                                      ? [
                                          ...bodyMultipartEntries,
                                          {
                                            key: "",
                                            value: fileName,
                                            type: "file" as const,
                                            fileName,
                                            fileBase64,
                                          },
                                        ]
                                      : bodyMultipartEntries.map((item, rowIndex) =>
                                          rowIndex === index
                                            ? {
                                                ...item,
                                                value: fileName,
                                                type: "file" as const,
                                                fileName,
                                                fileBase64,
                                              }
                                            : item
                                        )
                                    onBodyMultipartEntriesChange(next)
                                  })
                                }}
                                className="h-7 rounded-md border-border/50 !bg-transparent text-xs file:mr-2 file:border-0 file:bg-transparent file:text-xs"
                              />
                              {(row.fileName || row.value) && (
                                <span className="max-w-32 truncate text-[11px] text-muted-foreground">
                                  {row.fileName || row.value}
                                </span>
                              )}
                            </div>
                          ) : (
                            <Input
                              value={row.value}
                              onChange={(event) => {
                                const nextValue = event.target.value
                                if (isNew && !nextValue.trim()) return
                                const next = isNew
                                  ? [
                                      ...bodyMultipartEntries,
                                      {
                                        key: "",
                                        value: nextValue,
                                        type: "text" as const,
                                      },
                                    ]
                                  : bodyMultipartEntries.map(
                                      (item, rowIndex) =>
                                        rowIndex === index
                                          ? { ...item, value: nextValue }
                                          : item
                                    )
                                onBodyMultipartEntriesChange(next)
                              }}
                              className="h-7 rounded-md border-border/50 !bg-transparent font-mono text-xs"
                              placeholder="value"
                            />
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <Select
                            value={row.type}
                            onValueChange={(value) => {
                              const nextType =
                                value === "file" ? "file" : "text"
                              if (isNew) {
                                onBodyMultipartEntriesChange([
                                  ...bodyMultipartEntries,
                                  { key: "", value: "", type: nextType },
                                ])
                                return
                              }
                              onBodyMultipartEntriesChange(
                                bodyMultipartEntries.map((item, rowIndex) =>
                                  rowIndex === index
                                    ? { ...item, type: nextType }
                                    : item
                                )
                              )
                            }}
                          >
                            <SelectTrigger className="h-7 rounded-md border-border/50 !bg-transparent text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">text</SelectItem>
                              <SelectItem value="file">file</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right">
                          {!isNew && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-rose-400 hover:text-rose-300"
                              onClick={() =>
                                onBodyMultipartEntriesChange(
                                  bodyMultipartEntries.filter(
                                    (_, rowIndex) => rowIndex !== index
                                  )
                                )
                              }
                            >
                              <Trash className="size-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : bodyMode === "binary" ? (
            <div className="grid h-full content-start gap-3 rounded-md !bg-transparent bg-muted/10">
              <p className="text-xs text-muted-foreground">
                Provide a binary file path for the request body.
              </p>
              <div className="flex max-w-xl items-center gap-2">
                <Input
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (!file) return
                    void readFileAsBase64(file).then((fileBase64) => {
                      onBodyBinaryFileSelect({ fileName: file.name, fileBase64 })
                    })
                  }}
                  className="h-8 flex-1 rounded-md border-border/50 !bg-transparent text-xs file:mr-2 file:border-0 file:bg-transparent file:text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-xs"
                  onClick={onBodyBinaryClear}
                >
                  Clear
                </Button>
              </div>
              {bodyBinaryFileName && (
                <p className="max-w-xl truncate text-[11px] text-muted-foreground">
                  Selected file: {bodyBinaryFileName}
                </p>
              )}
              <Input
                value={bodyBinaryPath}
                onChange={(event) => onBodyBinaryPathChange(event.target.value)}
                className="h-8 max-w-xl rounded-md border-border/50 !bg-transparent text-xs"
                placeholder="Selected file name (draft value)"
              />
            </div>
          ) : (
            <div className="boson-json-editor h-full overflow-hidden !bg-transparent">
              <div className="h-full overflow-hidden !bg-transparent">
                <Editor
                  height="100%"
                  defaultLanguage={languageForMode(bodyMode)}
                  language={languageForMode(bodyMode)}
                  value={bodyText}
                  theme={editorTheme}
                  onChange={(value) => onBodyChange(value ?? "")}
                  options={{
                    minimap: { enabled: false },
                    lineNumbers: "on",
                    lineNumbersMinChars: 4,
                    lineDecorationsWidth: 12,
                    glyphMargin: false,
                    folding: false,
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                    fontSize: 12,
                    lineHeight: 20,
                    padding: { top: 10, bottom: 10 },
                    renderLineHighlight: "none",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </TabsContent>
  )
}
