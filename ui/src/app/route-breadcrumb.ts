import type { RouteDefinition } from "@/api"

export function buildRouteBreadcrumb(route?: RouteDefinition): string[] {
  if (!route) return []

  const source = route.source_path?.replace(/\\/g, "/") ?? ""
  const sourceParts = source.split("/").filter(Boolean)
  const folderParts = sourceParts.slice(0, -1)

  if (folderParts.length > 0) {
    return [...folderParts, route.name]
  }

  const fallbackCollection = route.group?.trim() || "Ungrouped"
  return [fallbackCollection, route.name]
}
