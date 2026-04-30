import type { RouteDefinition } from "@/api"

export type RouteStatus = "passed" | "failed"

export type RouteTreeNode = {
  kind: "collection" | "folder" | "route"
  label: string
  path: string
  route?: RouteDefinition
  children: RouteTreeNode[]
}
