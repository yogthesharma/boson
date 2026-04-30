import type { RouteDefinition } from "@/api"
import type { RouteTreeNode } from "./types"

export function buildRouteTree(routes: RouteDefinition[]): RouteTreeNode[] {
  const roots = new Map<string, RouteTreeNode>()

  for (const route of routes) {
    const source = route.source_path ?? ""
    const fileParts = source.split("/").filter(Boolean)
    const folderParts = fileParts.slice(0, -1)
    const fallbackCollection = route.group?.trim() || "Ungrouped"
    const collection = folderParts[0] ?? fallbackCollection
    const nestedFolders = folderParts.length > 1 ? folderParts.slice(1) : []
    const collectionKey = `collection:${collection}`

    let root = roots.get(collectionKey)
    if (!root) {
      root = {
        kind: "collection",
        label: collection,
        path: collectionKey,
        children: [],
      }
      roots.set(collectionKey, root)
    }

    let parent = root
    for (const folder of nestedFolders) {
      const folderPath = `${parent.path}/${folder}`
      let folderNode = parent.children.find(
        (child) => child.kind !== "route" && child.path === folderPath
      )
      if (!folderNode) {
        folderNode = {
          kind: "folder",
          label: folder,
          path: folderPath,
          children: [],
        }
        parent.children.push(folderNode)
      }
      parent = folderNode
    }

    parent.children.push({
      kind: "route",
      label: route.name,
      path: `route:${route.id}`,
      route,
      children: [],
    })
  }

  return Array.from(roots.values()).map(sortNode)
}

export function flattenLeafRoutes(node: RouteTreeNode): RouteDefinition[] {
  if (node.kind === "route" && node.route) return [node.route]
  return node.children.flatMap(flattenLeafRoutes)
}

function sortNode(node: RouteTreeNode): RouteTreeNode {
  const children = [...node.children]
  children.sort((a, b) => {
    if (a.kind === "route" && b.kind !== "route") return 1
    if (a.kind !== "route" && b.kind === "route") return -1
    return a.label.localeCompare(b.label)
  })
  return {
    ...node,
    children: children.map(sortNode),
  }
}
