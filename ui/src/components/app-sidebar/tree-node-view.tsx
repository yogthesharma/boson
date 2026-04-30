import { CaretDown, CaretRight } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { methodClass } from "./styles"
import { flattenLeafRoutes } from "./tree"
import type { RouteStatus, RouteTreeNode } from "./types"

type TreeNodeViewProps = {
  node: RouteTreeNode
  selectedRouteId?: string
  expandedPaths: Record<string, boolean>
  onTogglePath: (path: string) => void
  onSelectRoute: (routeId: string) => void
  lastRunByRoute: Record<string, RouteStatus>
}

export function TreeNodeView({
  node,
  selectedRouteId,
  expandedPaths,
  onTogglePath,
  onSelectRoute,
  lastRunByRoute,
}: TreeNodeViewProps) {
  if (node.kind === "route" && node.route) {
    return (
      <SidebarMenuItem className="group !w-full">
        <SidebarMenuSubButton
          asChild
          isActive={selectedRouteId === node.route.id}
        >
          <button
            type="button"
            onClick={() => onSelectRoute(node.route!.id)}
            className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 text-left"
          >
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${methodClass(node.route.method)}`}
            >
              {node.route.method.toUpperCase()}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block w-full min-w-0 truncate">
                  {node.route.name}
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                <span>
                  {node.route.method.toUpperCase()} {node.route.path}
                </span>
              </TooltipContent>
            </Tooltip>
          </button>
        </SidebarMenuSubButton>
      </SidebarMenuItem>
    )
  }

  const isExpanded = expandedPaths[node.path] ?? true
  const childRouteCount = flattenLeafRoutes(node).length
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <button
          type="button"
          className="font-medium"
          onClick={() => onTogglePath(node.path)}
        >
          {isExpanded ? (
            <CaretDown className="size-3.5" />
          ) : (
            <CaretRight className="size-3.5" />
          )}
          <span className="truncate">{node.label}</span>
          <Badge variant="secondary">{childRouteCount}</Badge>
        </button>
      </SidebarMenuButton>
      <div
        className={`grid overflow-hidden transition-all duration-200 ease-out ${
          isExpanded
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 !w-full">
          <SidebarMenuSub>
            {node.children.map((child) => (
              <TreeNodeView
                key={child.path}
                node={child}
                selectedRouteId={selectedRouteId}
                expandedPaths={expandedPaths}
                onTogglePath={onTogglePath}
                onSelectRoute={onSelectRoute}
                lastRunByRoute={lastRunByRoute}
              />
            ))}
          </SidebarMenuSub>
        </div>
      </div>
    </SidebarMenuItem>
  )
}
