import { useMemo } from "react"
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
import type { EnvironmentConfig, RouteDefinition } from "@/api"
import { buildRouteBreadcrumb } from "./route-breadcrumb"

type MainHeaderProps = {
  selectedRoute?: RouteDefinition
  activeEnvironment: string
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

export function MainHeader(props: MainHeaderProps) {
  const {
    selectedRoute,
    activeEnvironment,
    environments,
    onEnvironmentChange,
  } = props
  const breadcrumbParts = useMemo(
    () => buildRouteBreadcrumb(selectedRoute),
    [selectedRoute]
  )
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
      </div>
    </header>
  )
}
