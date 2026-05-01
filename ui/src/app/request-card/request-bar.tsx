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
  hasDraftChanges: boolean
  onMethodChange: (value: string) => void
  onUrlChange: (value: string) => void
  onResetDraft: () => void
  isRunning: boolean
  onRun: () => void
}

export function RequestBar({
  requestMethod,
  requestUrl,
  hasDraftChanges,
  onMethodChange,
  onUrlChange,
  onResetDraft,
  isRunning,
  onRun,
}: RequestBarProps) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-background p-1">
      <Select value={requestMethod.toUpperCase()} onValueChange={onMethodChange}>
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
      <Input
        value={requestUrl}
        onChange={(event) => onUrlChange(event.target.value)}
        aria-label="Request URL"
        className="h-9 border-0 !bg-transparent text-sm shadow-none focus-visible:ring-0"
      />
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
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  size="default"
                  className="h-9 min-w-24 px-4 font-medium"
                  onClick={onRun}
                  disabled={isRunning}
                >
                  {isRunning ? "Sending..." : "Send"}
                </Button>
              </span>
            </TooltipTrigger>
            {hasDraftChanges && (
              <TooltipContent sideOffset={6}>
                Edits are local preview only; run uses code route.
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}
