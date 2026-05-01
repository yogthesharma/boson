import type { ReactNode } from "react"
import type { RouteDefinition } from "@/api"

export type RequestAssertion = RouteDefinition["tests"][number]
export type RequestAuthConfig = NonNullable<RouteDefinition["auth"]>
export type RequestVar = { key: string; value: string; enabled: boolean }
export type MultipartField = {
  key: string
  value: string
  type: "text" | "file"
  fileName?: string
  fileBase64?: string
}
export type RequestBodyMode =
  | "none"
  | "json"
  | "xml"
  | "text"
  | "sparql"
  | "form_urlencoded"
  | "multipart_form"
  | "binary"

export type RequestTabState = {
  method: string
  url: string
  params: Array<[string, string]>
  headers: Array<[string, string]>
  bodyMode: RequestBodyMode
  bodyText: string
  bodyFormEntries: Array<[string, string]>
  bodyMultipartEntries: MultipartField[]
  bodyBinaryPath: string
  bodyBinaryFileName: string
  bodyBinaryBase64: string
  assertions: RequestAssertion[]
  auth: {
    type: "none" | "basic" | "bearer" | "api_key"
    username: string
    password: string
    token: string
    apiKeyName: string
    apiKeyValue: string
    apiKeyAddTo: "header" | "query"
  }
  vars: RequestVar[]
  script: { preRequest: string; postResponse: string }
  docs: { summary: string; description: string }
  file: { mode: "none" | "binary" | "multipart"; path: string; multipart: MultipartField[] }
  settings: { timeoutMs: string; followRedirects: boolean; retryCount: string }
}

export function formatTestType(type: RouteDefinition["tests"][number]["type"]) {
  return type.replaceAll("_", " ")
}

export function describeTest(test: RequestAssertion): ReactNode {
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

export function updateQueryEntriesInPath(
  path: string,
  entries: Array<[string, string]>
): string {
  const [base] = path.split("?")
  if (entries.length === 0) return base
  const query = entries
    .map(([key, value]) => {
      const encodedKey = encodeURIComponent(key)
      const encodedValue = encodeURIComponent(value)
      return `${encodedKey}=${encodedValue}`
    })
    .join("&")
  return `${base}?${query}`
}

export function normalizeEntryRows(
  entries: Array<[string, string]>
): Array<[string, string]> {
  return entries.filter(
    ([key, value]) => key.trim().length > 0 || value.trim().length > 0
  )
}

export function normalizeVarRows(vars: RequestVar[]): RequestVar[] {
  return vars
    .map((item) => ({
      key: item.key ?? "",
      value: item.value ?? "",
      enabled: item.enabled !== false,
    }))
    .filter(
      (item) => item.key.trim().length > 0 || item.value.trim().length > 0
    )
}

export function normalizeMultipartRows(rows: MultipartField[]): MultipartField[] {
  return rows
    .map((row) => ({
      key: row.key ?? "",
      value: row.value ?? "",
      type: row.type === "file" ? "file" : "text",
      fileName: row.fileName ?? "",
      fileBase64: row.fileBase64 ?? "",
    }))
    .filter(
      (row) =>
        row.key.trim().length > 0 ||
        row.value.trim().length > 0 ||
        (row.fileName?.trim().length ?? 0) > 0 ||
        (row.fileBase64?.trim().length ?? 0) > 0
    )
}

export function getInitialRequestTabState(route: RouteDefinition): RequestTabState {
  const params = normalizeEntryRows(extractQueryEntries(route.path))
  const headers = normalizeEntryRows(
    Object.entries(route.headers ?? {}).map(([key, value]) => [key, value] as [
      string,
      string,
    ])
  )
  const auth = route.auth ?? {}
  const vars = normalizeVarRows(
    (route.vars ?? []).map((item) => ({
      key: item.key,
      value: item.value,
      enabled: item.enabled !== false,
    }))
  )
  const multipart = normalizeMultipartRows(
    (route.file?.multipart ?? []).map((item) => ({
      key: item.key,
      value: item.value ?? "",
      type: item.type === "file" ? "file" : "text",
      fileName: "",
      fileBase64: "",
    }))
  )

  const contentTypeHeader = Object.entries(route.headers ?? {}).find(
    ([key]) => key.toLowerCase() === "content-type"
  )?.[1]
  const lowerContentType = (contentTypeHeader ?? "").toLowerCase()
  const configMode = route.body_config?.mode
  const inferredBodyMode: RequestBodyMode =
    configMode === "none" ||
    configMode === "json" ||
    configMode === "xml" ||
    configMode === "text" ||
    configMode === "sparql" ||
    configMode === "form_urlencoded" ||
    configMode === "multipart_form" ||
    configMode === "binary"
      ? configMode
      : route.file?.mode === "binary"
      ? "binary"
      : route.file?.mode === "multipart"
        ? "multipart_form"
        : route.body === undefined
          ? "none"
          : lowerContentType.includes("application/x-www-form-urlencoded")
            ? "form_urlencoded"
            : lowerContentType.includes("application/sparql-query")
              ? "sparql"
              : lowerContentType.includes("application/xml") ||
                  lowerContentType.includes("text/xml")
                ? "xml"
                : lowerContentType.includes("text/plain")
                  ? "text"
                  : "json"

  const bodyFormEntriesFromConfig = normalizeEntryRows(
    (route.body_config?.form_entries ?? []).map((entry) => [
      entry.key,
      entry.value ?? "",
    ]) as Array<[string, string]>
  )

  const bodyFormEntries =
    bodyFormEntriesFromConfig.length > 0
      ? bodyFormEntriesFromConfig
      : inferredBodyMode === "form_urlencoded"
        ? normalizeEntryRows(
            (() => {
              if (route.body && typeof route.body === "object" && !Array.isArray(route.body)) {
                return Object.entries(route.body as Record<string, unknown>).map(
                  ([key, value]) => [key, String(value ?? "")]
                ) as Array<[string, string]>
              }
              if (typeof route.body === "string") {
                return route.body
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
              return []
            })()
          )
        : []

  const bodyMultipartEntriesFromConfig = normalizeMultipartRows(
    (route.body_config?.multipart_entries ?? []).map((item) => ({
      key: item.key,
      value: item.value ?? "",
      type: item.type === "file" ? "file" : "text",
      fileName: "",
      fileBase64: "",
    }))
  )

  const bodyText =
    route.body_config?.raw ??
    (typeof route.body === "string"
      ? route.body
      : route.body
        ? JSON.stringify(route.body, null, 2)
        : "")

  return {
    method: route.method.toUpperCase(),
    url: route.path,
    params,
    headers,
    bodyMode: inferredBodyMode,
    bodyText,
    bodyFormEntries,
    bodyMultipartEntries:
      bodyMultipartEntriesFromConfig.length > 0 ? bodyMultipartEntriesFromConfig : multipart,
    bodyBinaryPath: route.body_config?.binary_path ?? route.file?.path ?? "",
    bodyBinaryFileName: "",
    bodyBinaryBase64: "",
    assertions: route.tests ?? [],
    auth: {
      type: auth.type ?? "none",
      username: auth.basic?.username ?? "",
      password: auth.basic?.password ?? "",
      token: auth.bearer?.token ?? "",
      apiKeyName: auth.api_key?.key ?? "",
      apiKeyValue: auth.api_key?.value ?? "",
      apiKeyAddTo: auth.api_key?.add_to === "query" ? "query" : "header",
    },
    vars,
    script: {
      preRequest: route.script?.pre_request ?? "",
      postResponse: route.script?.post_response ?? "",
    },
    docs: {
      summary: route.docs?.summary ?? "",
      description: route.docs?.description ?? "",
    },
    file: {
      mode:
        route.file?.mode === "binary" || route.file?.mode === "multipart"
          ? route.file.mode
          : "none",
      path: route.file?.path ?? "",
      multipart,
    },
    settings: {
      timeoutMs:
        route.settings?.timeout_ms !== undefined
          ? String(route.settings.timeout_ms)
          : "",
      followRedirects: route.settings?.follow_redirects !== false,
      retryCount:
        route.settings?.retry_count !== undefined
          ? String(route.settings.retry_count)
          : "",
    },
  }
}

export function withUpdatedParams(
  state: RequestTabState,
  nextParams: Array<[string, string]>
): RequestTabState {
  const cleaned = normalizeEntryRows(nextParams)
  return {
    ...state,
    params: cleaned,
    url: updateQueryEntriesInPath(state.url, cleaned),
  }
}

export function withUpdatedUrl(
  state: RequestTabState,
  nextUrl: string
): RequestTabState {
  return {
    ...state,
    url: nextUrl,
    params: normalizeEntryRows(extractQueryEntries(nextUrl)),
  }
}

export function withUpdatedHeaders(
  state: RequestTabState,
  nextHeaders: Array<[string, string]>
): RequestTabState {
  return { ...state, headers: normalizeEntryRows(nextHeaders) }
}

export function withUpdatedVars(
  state: RequestTabState,
  nextVars: RequestVar[]
): RequestTabState {
  return { ...state, vars: normalizeVarRows(nextVars) }
}

export function withUpdatedMultipart(
  state: RequestTabState,
  nextRows: MultipartField[]
): RequestTabState {
  return { ...state, file: { ...state.file, multipart: normalizeMultipartRows(nextRows) } }
}

export function toStateFingerprint(state: RequestTabState): string {
  return JSON.stringify({
    ...state,
    params: normalizeEntryRows(state.params),
    headers: normalizeEntryRows(state.headers),
    bodyFormEntries: normalizeEntryRows(state.bodyFormEntries),
    bodyMultipartEntries: normalizeMultipartRows(state.bodyMultipartEntries),
    bodyBinaryFileName: state.bodyBinaryFileName,
    bodyBinaryBase64: state.bodyBinaryBase64,
    vars: normalizeVarRows(state.vars),
    file: { ...state.file, multipart: normalizeMultipartRows(state.file.multipart) },
  })
}
