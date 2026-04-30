import { useMemo } from "react"
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
import type { RouteDefinition } from "@/api"
import { buildRouteBreadcrumb } from "./route-breadcrumb"

type MainHeaderProps = {
  selectedRoute?: RouteDefinition
  activeEnvironment: string
  sseConnected: boolean
}

export function MainHeader(props: MainHeaderProps) {
  const { selectedRoute, activeEnvironment, sseConnected } = props
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
        {selectedRoute && (
          <Badge variant="outline">{selectedRoute.method.toUpperCase()}</Badge>
        )}
        <Badge variant="secondary">{activeEnvironment}</Badge>
        <Badge variant={sseConnected ? "default" : "secondary"}>
          {sseConnected ? "Live" : "Syncing"}
        </Badge>
      </div>
    </header>
  )
}
