import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { methodTextClass } from "./helpers"

const METHOD_OPTIONS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const

type RequestBarProps = {
  requestMethod: string
  requestUrl: string
  activeEnvironment: string
  activeBaseUrl: string
  missingVariables: string[]
  diagnostics: {
    errorCount: number
    warningCount: number
    summaryText?: string
    blockingMessage?: string
  }
  hasDraftChanges: boolean
  onMethodChange: (value: string) => void
  onUrlChange: (value: string) => void
  onResetDraft: () => void
  isRunning: boolean
  onRun: () => void
}

function formatEnvironmentLabel(name: string): string {
  const value = name.trim()
  if (!value) return "Local"
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

export function RequestBar({
  requestMethod,
  requestUrl,
  activeEnvironment,
  activeBaseUrl,
  missingVariables,
  diagnostics,
  hasDraftChanges,
  onMethodChange,
  onUrlChange,
  onResetDraft,
  isRunning,
  onRun,
}: RequestBarProps) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-background p-1">
      <Select
        value={requestMethod.toUpperCase()}
        onValueChange={onMethodChange}
      >
        <SelectTrigger
          className={`h-9 w-32 rounded-none border-0 !bg-transparent font-semibold shadow-none focus:ring-0 focus-visible:ring-0 ${methodTextClass(
            requestMethod
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
      <div className="flex items-center gap-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                className="h-6 shrink-0 rounded-sm bg-muted px-2 text-[10px] tracking-wide"
              >
                ENV: {formatEnvironmentLabel(activeEnvironment)}
              </Badge>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>
              Runtime context - base URL: {activeBaseUrl}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Input
          value={requestUrl}
          onChange={(event) => onUrlChange(event.target.value)}
          aria-label="Request URL"
          className="h-9 border-0 !bg-transparent pl-1 text-sm shadow-none focus-visible:ring-0"
        />
      {missingVariables.length > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="destructive" className="h-6 shrink-0 px-2 text-[10px]">
                Missing vars ({missingVariables.length})
              </Badge>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>
              Missing environment variables: {missingVariables.join(", ")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      </div>
      {hasDraftChanges && (
        <Badge variant="outline" className="h-6 shrink-0 px-2 text-[11px]">
          Edited
        </Badge>
      )}
      {hasDraftChanges && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2 text-muted-foreground"
                onClick={onResetDraft}
              >
                Reset to default
              </Button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>
              Changes here are temporary and not saved to your route files.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      <div className="ml-auto flex items-center gap-2">
        {(diagnostics.errorCount > 0 || diagnostics.warningCount > 0) && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant={diagnostics.errorCount > 0 ? "destructive" : "outline"}
                  className="h-6 shrink-0 px-2 text-[10px]"
                >
                  {diagnostics.errorCount}E/{diagnostics.warningCount}W
                </Badge>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>
                {diagnostics.summaryText ??
                  diagnostics.blockingMessage ??
                  "Warnings detected. You can still run this request."}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  size="default"
                  className="h-9 min-w-24 px-4 font-medium"
                  onClick={onRun}
                  disabled={isRunning || diagnostics.errorCount > 0}
                >
                  {isRunning ? "Sending..." : "Send"}
                </Button>
              </span>
            </TooltipTrigger>
            {(hasDraftChanges ||
              diagnostics.errorCount > 0 ||
              diagnostics.warningCount > 0) && (
              <TooltipContent sideOffset={6}>
                {diagnostics.blockingMessage ??
                  diagnostics.summaryText ??
                  "Edits are local preview only; run uses code route."}
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}
