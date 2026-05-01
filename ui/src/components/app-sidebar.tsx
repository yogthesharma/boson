import type * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { Funnel, MagnifyingGlass } from "@phosphor-icons/react"
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
  const [commandSearch, setCommandSearch] = useState("")
  const [openSearch, setOpenSearch] = useState(false)
  const [methodFilter, setMethodFilter] = useState<string>("all")
  const [groupFilter, setGroupFilter] = useState<string>("all")
  const [failedOnly, setFailedOnly] = useState(false)
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>(
    () => readExpandedState()
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpenSearch(true)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const sidebarRoutes = useMemo(
    () =>
      routes.filter((route) => {
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
    [routes, methodFilter, groupFilter, failedOnly, lastRunByRoute]
  )

  const tree = useMemo(() => buildRouteTree(sidebarRoutes), [sidebarRoutes])
  const commandRoutes = useMemo(
    () =>
      sidebarRoutes.filter((route) => {
        const query = commandSearch.trim().toLowerCase()
        if (!query) return true
        const haystack =
          `${route.name} ${route.path} ${route.method} ${route.group ?? ""} ${route.source_path ?? ""}`.toLowerCase()
        return haystack.includes(query)
      }),
    [sidebarRoutes, commandSearch]
  )
  const commandTree = useMemo(() => buildRouteTree(commandRoutes), [commandRoutes])
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
  const routeResults = useMemo(
    () => commandTree.flatMap((branch) => flattenLeafRoutes(branch)),
    [commandTree]
  )
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (methodFilter !== "all") count += 1
    if (groupFilter !== "all") count += 1
    if (failedOnly) count += 1
    return count
  }, [methodFilter, groupFilter, failedOnly])

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
            <SidebarMenuButton className="!pt-0 !pb-0" size="lg" asChild>
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
      <SidebarRail />

      <CommandDialog
        open={openSearch}
        onOpenChange={setOpenSearch}
        title="Search routes"
        description="Find and jump to routes quickly."
        className="sm:max-w-2xl"
      >
        <Command>
          <CommandInput
            placeholder="Search routes (Cmd/Ctrl + K)..."
            value={commandSearch}
            onValueChange={setCommandSearch}
          />
          <div className="mx-1 mt-1 flex items-center justify-between rounded-md border border-sidebar-border/70 bg-sidebar-accent/40 px-2.5 py-1.5 text-[11px] text-sidebar-foreground/70">
            <span>
              {routeResults.length} result{routeResults.length === 1 ? "" : "s"}{" "}
              / {routes.length} total routes
            </span>
            <span>
              {activeFilterCount > 0
                ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active`
                : "No filters active"}
            </span>
          </div>
          <CommandList className="max-h-[50vh]">
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
            {commandTree.map((branch) => (
              <CommandGroup key={branch.path} heading={branch.label}>
                {flattenLeafRoutes(branch).map((route) => (
                  <CommandItem
                    key={route.id}
                    value={`${route.name} ${route.path} ${route.method} ${route.id}`}
                    className="items-start gap-2.5 py-2"
                    onSelect={() => {
                      onSelectRoute(route.id)
                      setOpenSearch(false)
                    }}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{route.name}</span>
                        <span
                          className={`shrink-0 text-[10px] ${methodClass(route.method)}`}
                        >
                          {route.method.toUpperCase()}
                        </span>
                      </div>
                      <div className="truncate text-[11px] text-sidebar-foreground/70">
                        {route.path}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-sidebar-foreground/55">
                        <span>Group: {route.group?.trim() || "Ungrouped"}</span>
                        <span>
                          Status: {lastRunByRoute[route.id] ?? "not run"}
                        </span>
                        {route.source_path && (
                          <span className="truncate">File: {route.source_path}</span>
                        )}
                      </div>
                    </div>
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
