import type * as React from "react"
import { useMemo, useState } from "react"
import { Funnel, MagnifyingGlass } from "@phosphor-icons/react"
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
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import type { RouteDefinition } from "@/api"
import { methodClass } from "@/components/app-sidebar/styles"
import {
  readExpandedState,
  writeExpandedState,
} from "@/components/app-sidebar/storage"
import {
  flattenLeafRoutes,
  buildRouteTree,
} from "@/components/app-sidebar/tree"
import { TreeNodeView } from "@/components/app-sidebar/tree-node-view"
import type { RouteStatus } from "@/components/app-sidebar/types"

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  routes: RouteDefinition[]
  selectedRouteId?: string
  onSelectRoute: (routeId: string) => void
  lastRunByRoute: Record<string, RouteStatus>
  activeEnvironment: string
  isLoading: boolean
  syncToken: number
}

export function AppSidebar({
  routes,
  selectedRouteId,
  onSelectRoute,
  lastRunByRoute,
  activeEnvironment,
  isLoading,
  syncToken,
  ...props
}: AppSidebarProps) {
  const [search, setSearch] = useState("")
  const [openSearch, setOpenSearch] = useState(false)
  const [methodFilter, setMethodFilter] = useState<string>("all")
  const [groupFilter, setGroupFilter] = useState<string>("all")
  const [failedOnly, setFailedOnly] = useState(false)
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>(
    () => readExpandedState()
  )

  const filteredRoutes = useMemo(
    () =>
      routes.filter((route) => {
        const query = search.trim().toLowerCase()
        const searchHaystack =
          `${route.name} ${route.path} ${route.method} ${route.group ?? ""} ${route.source_path ?? ""}`.toLowerCase()
        if (query && !searchHaystack.includes(query)) return false
        if (
          methodFilter !== "all" &&
          route.method.toUpperCase() !== methodFilter
        )
          return false
        if (
          groupFilter !== "all" &&
          (route.group?.trim() || "Ungrouped") !== groupFilter
        )
          return false
        if (failedOnly && lastRunByRoute[route.id] !== "failed") return false
        return true
      }),
    [routes, search, methodFilter, groupFilter, failedOnly, lastRunByRoute]
  )

  const tree = useMemo(() => buildRouteTree(filteredRoutes), [filteredRoutes])
  const collectionOptions = useMemo(
    () =>
      Array.from(
        new Set(routes.map((route) => route.group?.trim() || "Ungrouped"))
      ),
    [routes]
  )
  const methodOptions = useMemo(
    () =>
      Array.from(
        new Set(routes.map((route) => route.method.toUpperCase()))
      ).sort(),
    [routes]
  )

  const togglePath = (path: string) => {
    setExpandedPaths((current) => {
      const next = { ...current, [path]: !current[path] }
      writeExpandedState(next)
      return next
    })
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <div className="flex w-full items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <BosonLogo
                    className="!size-5 text-primary"
                    spinToken={syncToken}
                  />
                  <div className="mt-0.5 flex flex-col gap-1 leading-none">
                    <span className="text-sm font-semibold">Boson</span>
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
              {!isLoading && routes.length > 0 && tree.length === 0 && (
                <SidebarMenuItem>
                  <SidebarMenuButton>No matching routes.</SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {tree.map((node) => (
                <TreeNodeView
                  key={node.path}
                  node={node}
                  selectedRouteId={selectedRouteId}
                  expandedPaths={expandedPaths}
                  onTogglePath={togglePath}
                  onSelectRoute={onSelectRoute}
                  lastRunByRoute={lastRunByRoute}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 py-1">
          <Badge variant="secondary" className="text-[10px]">
            {activeEnvironment}
          </Badge>
        </div>
      </SidebarFooter>
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
            <CommandGroup heading="Filters">
              <CommandItem onSelect={() => setFailedOnly((v) => !v)}>
                <Funnel className="size-3.5" />
                <span>Failed only</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {failedOnly ? "ON" : "OFF"}
                </span>
              </CommandItem>
              {methodOptions.map((method) => (
                <CommandItem
                  key={`method-${method}`}
                  onSelect={() =>
                    setMethodFilter((v) => (v === method ? "all" : method))
                  }
                >
                  <span>Method: {method}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {methodFilter === method ? "ON" : "OFF"}
                  </span>
                </CommandItem>
              ))}
              {collectionOptions.map((group) => (
                <CommandItem
                  key={`group-${group}`}
                  onSelect={() =>
                    setGroupFilter((v) => (v === group ? "all" : group))
                  }
                >
                  <span>Group: {group}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {groupFilter === group ? "ON" : "OFF"}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            {tree.map((branch) => (
              <CommandGroup key={branch.path} heading={branch.label}>
                {flattenLeafRoutes(branch).map((route) => (
                  <CommandItem
                    key={route.id}
                    value={`${route.name} ${route.path} ${route.method} ${route.id}`}
                    onSelect={() => {
                      onSelectRoute(route.id)
                      setOpenSearch(false)
                    }}
                  >
                    <span className="truncate">{route.name}</span>
                    <span
                      className={`ml-auto text-[10px] ${methodClass(route.method)}`}
                    >
                      {route.method.toUpperCase()}
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
