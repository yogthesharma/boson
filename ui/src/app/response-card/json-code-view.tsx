import { CaretDown, CaretUp, MagnifyingGlass, X } from "@phosphor-icons/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Editor from "@monaco-editor/react"
import type * as Monaco from "monaco-editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useTheme } from "@/components/theme-provider"

type JsonCodeViewProps = {
  content: string
}

export function JsonCodeView({ content }: JsonCodeViewProps) {
  const { theme } = useTheme()
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [matches, setMatches] = useState<Monaco.editor.FindMatch[]>([])
  const [activeMatch, setActiveMatch] = useState(0)
  const formattedJson = useMemo(() => {
    try {
      return JSON.stringify(JSON.parse(content), null, 2)
    } catch {
      return content || "{}"
    }
  }, [content])
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

  const revealMatch = useCallback(
    (index: number, nextMatches: Monaco.editor.FindMatch[] = matches) => {
      const editor = editorRef.current
      if (!editor || nextMatches.length === 0) return
      const safeIndex = ((index % nextMatches.length) + nextMatches.length) % nextMatches.length
      const range = nextMatches[safeIndex].range
      editor.setSelection(range)
      editor.revealLineInCenter(range.startLineNumber)
      setActiveMatch(safeIndex + 1)
    },
    [matches],
  )

  const runSearch = useCallback(
    (query: string) => {
      const editor = editorRef.current
      const model = editor?.getModel()
      if (!editor || !model || !query.trim()) {
        setMatches([])
        setActiveMatch(0)
        return
      }
      const found = model.findMatches(query, true, false, false, null, true)
      setMatches(found)
      if (found.length > 0) {
        revealMatch(0, found)
      } else {
        setActiveMatch(0)
      }
    },
    [revealMatch],
  )

  useEffect(() => {
    runSearch(searchQuery)
  }, [searchQuery, formattedJson, runSearch])

  return (
    <div className="boson-json-editor relative h-full overflow-hidden rounded-md !bg-transparent">
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md border border-border/70 bg-background/90 p-1 backdrop-blur">
        {!searchOpen ? (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Search response JSON"
            onClick={() => {
              setSearchOpen(true)
              window.setTimeout(() => searchInputRef.current?.focus(), 0)
            }}
          >
            <MagnifyingGlass className="size-4" />
          </Button>
        ) : (
          <>
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Find in response..."
              className="h-7 w-48 text-xs"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  if (event.shiftKey) {
                    revealMatch(activeMatch - 2)
                  } else {
                    revealMatch(activeMatch)
                  }
                }
              }}
            />
            <span className="min-w-16 text-center text-xs text-muted-foreground">
              {activeMatch}/{matches.length}
            </span>
            {searchQuery.trim().length > 0 && matches.length === 0 && (
              <span className="text-[11px] font-medium text-rose-400">
                No matches
              </span>
            )}
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={matches.length === 0}
              onClick={() => revealMatch(activeMatch - 2)}
              aria-label="Previous match"
            >
              <CaretUp className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={matches.length === 0}
              onClick={() => revealMatch(activeMatch)}
              aria-label="Next match"
            >
              <CaretDown className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Close search"
              onClick={() => {
                setSearchOpen(false)
                setSearchQuery("")
                editorRef.current?.focus()
              }}
            >
              <X className="size-4" />
            </Button>
          </>
        )}
      </div>
      <Editor
        height="100%"
        defaultLanguage="json"
        value={formattedJson}
        theme={editorTheme}
        onMount={(editor, monaco) => {
          editorRef.current = editor
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
            setSearchOpen(true)
            window.setTimeout(() => searchInputRef.current?.focus(), 0)
          })
        }}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          lineNumbers: "on",
          lineNumbersMinChars: 2,
          lineDecorationsWidth: 0,
          glyphMargin: false,
          folding: true,
          scrollBeyondLastLine: false,
          wordWrap: "on",
          fontSize: 12,
          lineHeight: 20,
          padding: { top: 12, bottom: 12 },
          renderLineHighlight: "none",
          find: {
            addExtraSpaceOnTop: false,
            autoFindInSelection: "never",
            seedSearchStringFromSelection: "never",
          },
        }}
      />
    </div>
  )
}
