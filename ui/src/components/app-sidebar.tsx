import type * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { MagnifyingGlass } from "@phosphor-icons/react"
import { BosonLogo } from "@/components/boson-logo"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
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
import { buildRouteTree } from "@/components/app-sidebar/tree"
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

  const tree = useMemo(() => buildRouteTree(routes), [routes])
  const routeResults = useMemo(
    () =>
      routes.filter((route) => {
        const query = commandSearch.trim().toLowerCase()
        if (!query) return true
        const haystack =
          `${route.name} ${route.path} ${route.method} ${route.group ?? ""} ${route.source_path ?? ""}`.toLowerCase()
        return haystack.includes(query)
      }),
    [routes, commandSearch]
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
        className="sm:max-w-xl"
      >
        <Command>
          <CommandInput
            placeholder="Search routes (Cmd/Ctrl + K)..."
            value={commandSearch}
            onValueChange={setCommandSearch}
          />
          <CommandList className="mt-2 max-h-[22rem] px-1">
            <CommandEmpty>No matching routes.</CommandEmpty>
            {routeResults.map((route) => (
              <CommandItem
                key={route.id}
                value={`${route.name} ${route.path} ${route.method} ${route.id}`}
                className="items-start px-3 py-2.5"
                onSelect={() => {
                  onSelectRoute(route.id)
                  setOpenSearch(false)
                }}
              >
                <div className="w-full min-w-0 space-y-0.5">
                  <div className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 text-left">
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${methodClass(route.method)}`}
                    >
                      {route.method.toUpperCase()}
                    </span>
                    <span className="block w-full min-w-0 truncate">
                      {route.name}
                    </span>
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </Sidebar>
  )
}
