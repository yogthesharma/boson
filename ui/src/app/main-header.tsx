import { useMemo } from "react"
import { CopySimple, EyeSlash, PencilSimple } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { EnvironmentConfig, RouteDefinition } from "@/api"
import { buildRouteBreadcrumb } from "./route-breadcrumb"

type MainHeaderProps = {
  selectedRoute?: RouteDefinition
  activeEnvironment: string
  activeBaseUrl: string
  activeEnvironmentConfig?: EnvironmentConfig
  defaultEnvironmentName: string
  defaultEnvironmentConfig?: EnvironmentConfig
  environments: EnvironmentConfig[]
  onEnvironmentChange: (name: string) => void
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

function toEnvironmentFilePath(environment?: EnvironmentConfig): string {
  if (!environment) return ".api/environments/<env>.json"
  if (environment.source_path?.trim()) {
    return `.api/environments/${environment.source_path}`
  }
  const safe = environment.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return `.api/environments/${safe || "environment"}.json`
}

function maskSecretValue(value: string): string {
  if (!value) return "******"
  return "\u2022".repeat(Math.max(6, Math.min(value.length, 16)))
}

export function MainHeader(props: MainHeaderProps) {
  const {
    selectedRoute,
    activeEnvironment,
    activeBaseUrl,
    activeEnvironmentConfig,
    defaultEnvironmentName,
    defaultEnvironmentConfig,
    environments,
    onEnvironmentChange,
  } = props
  const breadcrumbParts = useMemo(
    () => buildRouteBreadcrumb(selectedRoute),
    [selectedRoute]
  )
  const activeSecretKeys = useMemo(
    () => new Set(activeEnvironmentConfig?.secret_keys ?? []),
    [activeEnvironmentConfig]
  )
  const defaultSecretKeys = useMemo(
    () => new Set(defaultEnvironmentConfig?.secret_keys ?? []),
    [defaultEnvironmentConfig]
  )
  const defaultVariables = defaultEnvironmentConfig?.variables ?? {}
  const envFilePath = toEnvironmentFilePath(activeEnvironmentConfig)
  const variableRows = useMemo(() => {
    const keys = Array.from(
      new Set([
        ...Object.keys(activeEnvironmentConfig?.variables ?? {}),
        ...Object.keys(defaultVariables),
      ])
    ).sort((a, b) =>
      a.localeCompare(b)
    )
    return keys.map((key) => {
      const inActive = Object.prototype.hasOwnProperty.call(
        activeEnvironmentConfig?.variables ?? {},
        key
      )
      const value = inActive ? activeEnvironmentConfig?.variables?.[key] ?? "" : ""
      const defaultValue = defaultVariables[key]
      const inDefault = defaultValue !== undefined
      const changedFromDefault = defaultEnvironmentName
        ? inActive && inDefault && defaultValue !== value
        : false
      const onlyInActive = defaultEnvironmentName
        ? inActive && !inDefault
        : false
      const missingInActive = defaultEnvironmentName
        ? !inActive && inDefault
        : false
      return {
        key,
        value,
        inActive,
        isSecret: activeSecretKeys.has(key) || defaultSecretKeys.has(key),
        changedFromDefault,
        onlyInActive,
        missingInActive,
        defaultValue,
      }
    })
  }, [
    activeEnvironmentConfig,
    activeSecretKeys,
    defaultSecretKeys,
    defaultEnvironmentName,
    defaultVariables,
  ])

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 px-3">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger />
        <Separator orientation="vertical" className="mr-1 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbParts.length === 0 && (
              <BreadcrumbItem>
                <BreadcrumbPage>Routes</BreadcrumbPage>
              </BreadcrumbItem>
            )}
            {breadcrumbParts.map((part, index) => (
              <BreadcrumbItem key={`${part}-${index}`}>
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbPage className="max-w-40 truncate">
                  {part}
                </BreadcrumbPage>
              </BreadcrumbItem>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-2">
        <Select value={activeEnvironment} onValueChange={onEnvironmentChange}>
          <SelectTrigger className="h-7 min-w-36 border-border/60 !bg-transparent text-xs">
            <SelectValue placeholder="Environment" />
          </SelectTrigger>
          <SelectContent>
            {environments.map((environment) => (
              <SelectItem key={environment.name} value={environment.name}>
                {formatEnvironmentLabel(environment.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                className="h-7 max-w-[16rem] truncate bg-muted px-2 text-[10px]"
              >
                {activeBaseUrl}
              </Badge>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>
              Active base URL for runtime resolution
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs">
              Env Inspector
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[34rem] space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  {formatEnvironmentLabel(activeEnvironment)} environment
                </p>
                {defaultEnvironmentName && (
                  <Badge variant="outline" className="text-[10px]">
                    Default: {formatEnvironmentLabel(defaultEnvironmentName)}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Source of truth: <span className="font-mono">{envFilePath}</span>
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => void navigator.clipboard.writeText(envFilePath)}
              >
                <PencilSimple className="mr-1 size-3" />
                Edit in file (copy path)
              </Button>
            </div>
            <div className="max-h-72 overflow-auto rounded-md border border-border/70">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">Key</th>
                    <th className="px-2 py-1.5 text-left font-medium">Value</th>
                    <th className="px-2 py-1.5 text-left font-medium">Diff</th>
                    <th className="px-2 py-1.5 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {variableRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-2 py-3 text-center text-muted-foreground"
                      >
                        No variables configured for this environment.
                      </td>
                    </tr>
                  )}
                  {variableRows.map((row) => (
                    <tr
                      key={row.key}
                      className={`border-t border-border/40 ${
                        row.changedFromDefault || row.onlyInActive || row.missingInActive
                          ? "bg-amber-500/5"
                          : "bg-background"
                      }`}
                    >
                      <td className="px-2 py-1.5 font-mono text-[11px]">{row.key}</td>
                      <td className="px-2 py-1.5">
                        {!row.inActive ? (
                          <span className="text-muted-foreground">-</span>
                        ) : row.isSecret ? (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <EyeSlash className="size-3" />
                            {maskSecretValue(row.value)}
                          </span>
                        ) : (
                          <span className="font-mono text-[11px]">{row.value}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {row.onlyInActive && (
                          <Badge variant="outline" className="text-[10px]">
                            Added vs default
                          </Badge>
                        )}
                        {row.changedFromDefault && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-[10px]">
                                  Changed
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent sideOffset={6}>
                                Default value:{" "}
                                {row.isSecret
                                  ? maskSecretValue(row.defaultValue ?? "")
                                  : row.defaultValue}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {row.missingInActive && (
                          <Badge variant="outline" className="text-[10px]">
                            Missing vs default
                          </Badge>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[11px]"
                          disabled={row.isSecret || !row.inActive}
                          onClick={() => void navigator.clipboard.writeText(row.value)}
                        >
                          <CopySimple className="mr-1 size-3" />
                          Copy
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  )
}
