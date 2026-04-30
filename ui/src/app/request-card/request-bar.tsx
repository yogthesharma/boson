import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { RouteDefinition } from "@/api"
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
  selectedRoute: RouteDefinition
  isRunning: boolean
  onRun: () => void
}

export function RequestBar({
  selectedRoute,
  isRunning,
  onRun,
}: RequestBarProps) {
  return (
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
        className="h-9 border-0 !bg-transparent text-sm shadow-none focus-visible:ring-0"
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
  )
}
