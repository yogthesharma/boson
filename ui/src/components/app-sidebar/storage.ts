export function readExpandedState() {
  try {
    const raw = localStorage.getItem("boson.sidebar.expanded")
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (typeof parsed === "object" && parsed) {
      return parsed as Record<string, boolean>
    }
  } catch {
    // Ignore malformed local storage and use defaults.
  }
  return {}
}

export function writeExpandedState(value: Record<string, boolean>) {
  try {
    localStorage.setItem("boson.sidebar.expanded", JSON.stringify(value))
  } catch {
    // Ignore storage failures in private/incognito contexts.
  }
}
