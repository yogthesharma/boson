import type { ReactNode } from "react"
import type { RouteDefinition } from "@/api"

export function formatTestType(type: RouteDefinition["tests"][number]["type"]) {
  return type.replaceAll("_", " ")
}

export function describeTest(test: RouteDefinition["tests"][number]): ReactNode {
  if (test.type === "status") {
    return (
      <>
        expects <span className="font-mono">{test.equals}</span>
      </>
    )
  }
  if (test.type === "header_exists") {
    return (
      <>
        expects header <span className="font-mono">{test.key}</span> to exist
      </>
    )
  }
  if (test.type === "header_equals") {
    return (
      <>
        expects header <span className="font-mono">{test.key}</span> ={" "}
        <span className="font-mono">{test.equals}</span>
      </>
    )
  }
  if (test.type === "body_path_exists") {
    return (
      <>
        expects body path <span className="font-mono">{test.path}</span> to exist
      </>
    )
  }
  if (test.type === "body_path_equals") {
    return (
      <>
        expects body path <span className="font-mono">{test.path}</span> ={" "}
        <span className="font-mono">{JSON.stringify(test.equals)}</span>
      </>
    )
  }
  return (
    <>
      expects response time {"< "}
      <span className="font-mono">{test.less_than}ms</span>
    </>
  )
}

export function methodTextClass(method: string) {
  const upper = method.toUpperCase()
  if (upper === "GET") return "text-emerald-400"
  if (upper === "POST") return "text-sky-400"
  if (upper === "PUT" || upper === "PATCH") return "text-amber-400"
  if (upper === "DELETE") return "text-rose-400"
  return "text-muted-foreground"
}

export function extractQueryEntries(path: string): Array<[string, string]> {
  const [_, query = ""] = path.split("?")
  if (!query) return []
  return query
    .split("&")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((pair) => {
      const [key, value = ""] = pair.split("=")
      return [decodeURIComponent(key), decodeURIComponent(value)] as [
        string,
        string,
      ]
    })
}
