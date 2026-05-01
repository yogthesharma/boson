import { CopySimple, DownloadSimple } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { RunResult } from "@/api"

type ResponseToolbarProps = {
  result: RunResult | null
  responseSize: string
  onCopy: () => Promise<void>
  onDownload: () => void
}

export function ResponseToolbar(props: ResponseToolbarProps) {
  const { result, responseSize, onCopy, onDownload } = props
  const passedTests =
    result?.test_results.filter((test) => test.passed).length ?? 0
  const totalTests = result?.test_results.length ?? 0

  return (
    <div className="mt-1 flex items-center justify-between gap-3 px-2 pt-1">
      <TabsList
        variant="line"
        className="mr-4 ml-1 h-auto w-fit justify-start border-none p-0"
      >
        <TabsTrigger value="response">Response</TabsTrigger>
        <TabsTrigger value="headers">Headers</TabsTrigger>
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
        <TabsTrigger value="tests">Tests</TabsTrigger>
      </TabsList>

      <div className="flex items-center gap-2">
        <Badge variant="outline">JSON</Badge>
        {result && (
          <>
            <span
              className={`text-sm font-semibold ${
                result.status < 400 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {result.status} {result.status < 400 ? "OK" : "Error"}
            </span>
            <span className="text-muted-foreground">{result.elapsed_ms}ms</span>
            <span className="text-muted-foreground">{responseSize}</span>
            {totalTests > 0 && (
              <span
                className={
                  passedTests === totalTests
                    ? "text-xs font-medium text-emerald-400"
                    : "text-xs font-medium text-amber-400"
                }
              >
                Tests {passedTests}/{totalTests}
              </span>
            )}
          </>
        )}
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={() => void onCopy()}
          aria-label="Copy response"
        >
          <CopySimple className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={onDownload}
          aria-label="Download response"
        >
          <DownloadSimple className="size-4" />
        </Button>
      </div>
    </div>
  )
}
