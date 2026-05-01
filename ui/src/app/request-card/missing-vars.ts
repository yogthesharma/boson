import type { RequestTabState } from "./helpers"

export function computeMissingEnvironmentVariables(
  state: RequestTabState | null | undefined,
  activeEnvironmentVariables: Record<string, string>
): string[] {
  if (!state) return []

  const tokenPattern = /\{\{([^}]+)\}\}/g
  const known = new Set(Object.keys(activeEnvironmentVariables))
  const required = new Set<string>()

  const collect = (source: string) => {
    let match = tokenPattern.exec(source)
    while (match) {
      const key = match[1]?.trim()
      if (key) required.add(key)
      match = tokenPattern.exec(source)
    }
    tokenPattern.lastIndex = 0
  }

  collect(state.url)
  for (const [key, value] of state.headers) {
    collect(key)
    collect(value)
  }
  collect(state.bodyText)
  for (const [key, value] of state.bodyFormEntries) {
    collect(key)
    collect(value)
  }
  for (const item of state.bodyMultipartEntries) {
    collect(item.key)
    collect(item.value ?? "")
    collect(item.fileName ?? "")
  }
  collect(state.bodyBinaryPath)
  for (const item of state.vars) {
    collect(item.key)
    collect(item.value)
  }

  return Array.from(required)
    .filter((key) => !known.has(key))
    .sort()
}
