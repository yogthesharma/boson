import type * as React from "react"
import { useMemo, useState } from "react"
import { MagnifyingGlass } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { BosonLogo } from "@/components/boson-logo"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
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
  isLoading: boolean
  syncToken: number
}

export function AppSidebar({
  routes,
  selectedRouteId,
  onSelectRoute,
  isLoading,
  syncToken,
  ...props
}: AppSidebarProps) {
  const [search, setSearch] = useState("")
  const [openSearch, setOpenSearch] = useState(false)
  const grouped = useMemo(() => groupRoutes(routes, search), [routes, search])

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="flex w-full items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <BosonLogo
                    className="!size-7 text-primary"
                    spinToken={syncToken}
                  />
                  <div className="mt-0.5 flex flex-col gap-1 leading-none">
                    <span className="text-base font-bold">Boson</span>
                  </div>
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setOpenSearch(true)}
                  aria-label="Open route search"
                >
                  <MagnifyingGlass className="size-4" />
                </Button>
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
              {!isLoading && routes.length > 0 && grouped.length === 0 && (
                <SidebarMenuItem>
                  <SidebarMenuButton>No matching routes.</SidebarMenuButton>
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

      <CommandDialog
        open={openSearch}
        onOpenChange={setOpenSearch}
        title="Search routes"
        description="Find and jump to routes quickly."
      >
        <Command>
          <CommandInput
            placeholder="Search routes..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No matching routes.</CommandEmpty>
            {grouped.map((group) => (
              <CommandGroup key={group.title} heading={group.title}>
                {group.items.map((route) => (
                  <CommandItem
                    key={route.id}
                    value={`${route.name} ${route.path} ${route.method} ${route.id}`}
                    onSelect={() => {
                      onSelectRoute(route.id)
                      setOpenSearch(false)
                    }}
                  >
                    <span className="truncate">{route.name}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {route.method}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </Sidebar>
  )
}

function groupRoutes(routes: RouteDefinition[], search: string) {
  const map = new Map<string, RouteDefinition[]>()
  const query = search.trim().toLowerCase()

  for (const route of routes) {
    const searchable =
      `${route.name} ${route.path} ${route.method} ${route.group ?? ""}`.toLowerCase()
    if (query && !searchable.includes(query)) {
      continue
    }
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
