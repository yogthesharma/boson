export function methodClass(method: string) {
  const m = method.toUpperCase()
  if (m === "GET") return "bg-emerald-500/15 text-emerald-400"
  if (m === "POST") return "bg-sky-500/15 text-sky-400"
  if (m === "PUT" || m === "PATCH") return "bg-amber-500/15 text-amber-400"
  if (m === "DELETE") return "bg-rose-500/15 text-rose-400"
  return "bg-muted text-muted-foreground"
}

export function statusClass(status?: "passed" | "failed") {
  if (status === "passed") return "bg-emerald-500"
  if (status === "failed") return "bg-rose-500"
  return "bg-muted-foreground/40"
}
