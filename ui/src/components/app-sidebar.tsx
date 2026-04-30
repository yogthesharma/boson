import type * as React from "react"
import { Badge } from "@/components/ui/badge"
import { BosonLogo } from "@/components/boson-logo"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import type { RouteDefinition } from "@/api"

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  routes: RouteDefinition[]
  selectedRouteId?: string
  onSelectRoute: (routeId: string) => void
  activeEnvironment: string
  isLoading: boolean
  syncToken: number
}

export function AppSidebar({
  routes,
  selectedRouteId,
  onSelectRoute,
  activeEnvironment,
  isLoading,
  syncToken,
  ...props
}: AppSidebarProps) {
  const grouped = groupRoutes(routes)

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="flex items-center gap-2">
                <BosonLogo
                  className="!size-6 text-primary"
                  spinToken={syncToken}
                />
                <div className="mt-0.5 flex flex-col gap-0.5 leading-none">
                  <span className="text-md font-semibold">Boson</span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Routes</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading && (
                <SidebarMenuItem>
                  <SidebarMenuButton>Loading routes...</SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {!isLoading && routes.length === 0 && (
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    No routes. Run `boson init`.
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {grouped.map((group) => (
                <SidebarMenuItem key={group.title}>
                  <SidebarMenuButton asChild>
                    <button type="button" className="font-medium">
                      <span>{group.title}</span>
                      <Badge variant="secondary">{group.items.length}</Badge>
                    </button>
                  </SidebarMenuButton>
                  <SidebarMenuSub>
                    {group.items.map((route) => (
                      <SidebarMenuSubItem key={route.id}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={selectedRouteId === route.id}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectRoute(route.id)}
                            className="w-full text-left"
                          >
                            <span>{route.name}</span>
                          </button>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

function groupRoutes(routes: RouteDefinition[]) {
  const map = new Map<string, RouteDefinition[]>()

  for (const route of routes) {
    const group = route.group?.trim() || "Ungrouped"
    const bucket = map.get(group)
    if (bucket) {
      bucket.push(route)
    } else {
      map.set(group, [route])
    }
  }

  return Array.from(map.entries()).map(([title, items]) => ({
    title,
    items,
  }))
}
