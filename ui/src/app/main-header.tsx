import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { EnvironmentConfig, RouteDefinition } from "@/api"
import { buildRouteBreadcrumb } from "./route-breadcrumb"

type MainHeaderProps = {
  selectedRoute?: RouteDefinition
  activeEnvironment: string
  environments: EnvironmentConfig[]
  onEnvironmentChange: (name: string) => void
  onCreateEnvironment: (payload: EnvironmentConfig) => Promise<void>
  onUpdateEnvironment: (previousName: string, payload: EnvironmentConfig) => Promise<void>
  onDeleteEnvironment: (name: string) => Promise<void>
  sseConnected: boolean
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

export function MainHeader(props: MainHeaderProps) {
  const {
    selectedRoute,
    activeEnvironment,
    environments,
    onEnvironmentChange,
    onCreateEnvironment,
    onUpdateEnvironment,
    onDeleteEnvironment,
    sseConnected,
  } = props
  const breadcrumbParts = useMemo(
    () => buildRouteBreadcrumb(selectedRoute),
    [selectedRoute]
  )
  const selectedEnvironmentConfig = useMemo(
    () =>
      environments.find((environment) => environment.name === activeEnvironment) ??
      environments[0],
    [activeEnvironment, environments]
  )
  const [managerOpen, setManagerOpen] = useState(false)
  const [editingName, setEditingName] = useState(
    selectedEnvironmentConfig?.name ?? ""
  )
  const [variables, setVariables] = useState<Array<{ key: string; value: string; secret: boolean }>>(
    () => {
      if (!selectedEnvironmentConfig) return []
      const secretSet = new Set(selectedEnvironmentConfig.secret_keys ?? [])
      return Object.entries(selectedEnvironmentConfig.variables ?? {}).map(([key, value]) => ({
        key,
        value,
        secret: secretSet.has(key),
      }))
    }
  )

  const syncDraftFromSelectedEnvironment = () => {
    if (!selectedEnvironmentConfig) {
      setEditingName("")
      setVariables([])
      return
    }
    setEditingName(selectedEnvironmentConfig.name)
    const secretSet = new Set(selectedEnvironmentConfig.secret_keys ?? [])
    setVariables(
      Object.entries(selectedEnvironmentConfig.variables ?? {}).map(([key, value]) => ({
        key,
        value,
        secret: secretSet.has(key),
      }))
    )
  }

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
        {selectedRoute && (
          <Badge variant="outline">{selectedRoute.method.toUpperCase()}</Badge>
        )}
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
        <Popover
          open={managerOpen}
          onOpenChange={(nextOpen) => {
            setManagerOpen(nextOpen)
            if (nextOpen) syncDraftFromSelectedEnvironment()
          }}
        >
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs">
              Manage Envs
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[28rem] space-y-2">
            <div className="space-y-1">
              <p className="text-xs font-medium">Environment Name</p>
              <Input
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
                className="h-8 text-xs"
                placeholder="environment name"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium">Variables</p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() =>
                    setVariables((current) => [...current, { key: "", value: "", secret: false }])
                  }
                >
                  Add
                </Button>
              </div>
              <div className="max-h-56 space-y-2 overflow-auto pr-1">
                {variables.map((item, index) => (
                  <div key={`env-var-${index}`} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2">
                    <Input
                      value={item.key}
                      onChange={(event) =>
                        setVariables((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, key: event.target.value } : row
                          )
                        )
                      }
                      className="h-8 text-xs"
                      placeholder="key"
                    />
                    <Input
                      value={item.value}
                      onChange={(event) =>
                        setVariables((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, value: event.target.value } : row
                          )
                        )
                      }
                      className="h-8 text-xs"
                      type={item.secret ? "password" : "text"}
                      placeholder="value"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() =>
                        setVariables((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, secret: !row.secret } : row
                          )
                        )
                      }
                    >
                      {item.secret ? "Secret" : "Public"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-rose-500"
                      onClick={() =>
                        setVariables((current) => current.filter((_, rowIndex) => rowIndex !== index))
                      }
                    >
                      Del
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={!activeEnvironment}
                onClick={async () => {
                  if (!activeEnvironment) return
                  await onDeleteEnvironment(activeEnvironment)
                }}
              >
                Delete Current
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={async () => {
                  const payload: EnvironmentConfig = {
                    name: editingName.trim() || "untitled",
                    variables: Object.fromEntries(
                      variables
                        .filter((item) => item.key.trim().length > 0)
                        .map((item) => [item.key.trim(), item.value])
                    ),
                    secret_keys: variables
                      .filter((item) => item.secret && item.key.trim().length > 0)
                      .map((item) => item.key.trim()),
                  }
                  await onUpdateEnvironment(activeEnvironment, payload)
                }}
              >
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs"
                onClick={async () => {
                  const payload: EnvironmentConfig = {
                    name: editingName.trim() || "untitled",
                    variables: Object.fromEntries(
                      variables
                        .filter((item) => item.key.trim().length > 0)
                        .map((item) => [item.key.trim(), item.value])
                    ),
                    secret_keys: variables
                      .filter((item) => item.secret && item.key.trim().length > 0)
                      .map((item) => item.key.trim()),
                  }
                  await onCreateEnvironment(payload)
                }}
              >
                Create New
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <Badge variant={sseConnected ? "default" : "secondary"}>
          {sseConnected ? "Live" : "Syncing"}
        </Badge>
      </div>
    </header>
  )
}
