import type { RequestTabState } from "./helpers"

export type RequestDiagnosticSeverity = "error" | "warning"

export type RequestDiagnostic = {
  code: string
  severity: RequestDiagnosticSeverity
  message: string
}

export type RequestDiagnosticsResult = {
  items: RequestDiagnostic[]
  errors: RequestDiagnostic[]
  warnings: RequestDiagnostic[]
  blockingErrors: RequestDiagnostic[]
}

function looksSensitiveVarName(key: string): boolean {
  return /(base_url|token|apikey|api_key|auth|password|secret)/i.test(key)
}

function findContentTypeHeaderValue(headers: Array<[string, string]>): string {
  const entry = headers.find(([key]) => key.trim().toLowerCase() === "content-type")
  return (entry?.[1] ?? "").trim().toLowerCase()
}

function expectedContentTypeForMode(
  mode: RequestTabState["bodyMode"]
): string | null {
  if (mode === "json") return "application/json"
  if (mode === "xml") return "application/xml"
  if (mode === "text") return "text/plain"
  if (mode === "sparql") return "application/sparql-query"
  if (mode === "form_urlencoded") return "application/x-www-form-urlencoded"
  if (mode === "multipart_form") return "multipart/form-data"
  if (mode === "binary") return "application/octet-stream"
  return null
}

export function computeRequestDiagnostics(
  state: RequestTabState | null | undefined,
  missingVariables: string[]
): RequestDiagnosticsResult {
  if (!state) {
    return { items: [], errors: [], warnings: [], blockingErrors: [] }
  }

  const items: RequestDiagnostic[] = []
  const add = (severity: RequestDiagnosticSeverity, code: string, message: string) =>
    items.push({ severity, code, message })

  const url = state.url.trim()
  if (url.length === 0) {
    add("error", "url_empty", "Request URL/path cannot be empty.")
  } else if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      new URL(url)
    } catch {
      add("error", "url_invalid", "Absolute request URL is malformed.")
    }
  } else if (!url.startsWith("/")) {
    add("warning", "url_relative_style", "Relative path should usually start with '/'.")
  }

  if (missingVariables.length > 0) {
    add(
      "warning",
      "missing_vars",
      `Missing environment variables: ${missingVariables.join(", ")}`
    )
    const sensitiveMissing = missingVariables.filter(looksSensitiveVarName)
    if (sensitiveMissing.length > 0) {
      add(
        "error",
        "missing_sensitive_vars",
        `Missing required sensitive variables: ${sensitiveMissing.join(", ")}`
      )
    }
  }

  if (state.auth.type === "basic") {
    if (!state.auth.username.trim() || !state.auth.password.trim()) {
      add("error", "auth_basic_incomplete", "Basic auth requires both username and password.")
    }
  }
  if (state.auth.type === "bearer") {
    if (!state.auth.token.trim()) {
      add("error", "auth_bearer_incomplete", "Bearer auth requires a token.")
    }
  }
  if (state.auth.type === "api_key") {
    if (!state.auth.apiKeyName.trim() || !state.auth.apiKeyValue.trim()) {
      add("error", "auth_apikey_incomplete", "API key auth requires both key and value.")
    }
  }

  const authHeaderPresent = state.headers.some(
    ([key, value]) => key.trim().toLowerCase() === "authorization" && value.trim().length > 0
  )
  if (state.auth.type !== "none" && authHeaderPresent) {
    add(
      "warning",
      "auth_header_conflict",
      "Authorization header is already set and may conflict with Auth tab values."
    )
  }

  const bodyText = state.bodyText.trim()
  if (state.bodyMode === "json" && bodyText.length > 0) {
    try {
      JSON.parse(bodyText)
    } catch {
      add("error", "body_json_invalid", "Body mode is JSON but payload is not valid JSON.")
    }
  }
  if (state.bodyMode === "form_urlencoded") {
    const invalid = state.bodyFormEntries.some(
      ([key, value]) => key.trim().length === 0 && value.trim().length > 0
    )
    if (invalid) {
      add("error", "form_entry_key_missing", "Form URL Encoded rows with value must include key.")
    }
  }
  if (state.bodyMode === "multipart_form") {
    const invalid = state.bodyMultipartEntries.some((entry) => {
      const hasPayload =
        entry.value.trim().length > 0 ||
        (entry.fileName?.trim().length ?? 0) > 0 ||
        (entry.fileBase64?.trim().length ?? 0) > 0
      return hasPayload && entry.key.trim().length === 0
    })
    if (invalid) {
      add("error", "multipart_entry_key_missing", "Multipart rows with payload must include key.")
    }
  }
  if (state.bodyMode === "binary") {
    const hasBinaryPayload =
      state.bodyBinaryPath.trim().length > 0 || state.bodyBinaryBase64.trim().length > 0
    if (!hasBinaryPayload) {
      add("error", "binary_payload_missing", "Binary mode requires a file/path payload.")
    }
  }

  const contentType = findContentTypeHeaderValue(state.headers)
  const expected = expectedContentTypeForMode(state.bodyMode)
  if (expected && contentType) {
    const matches =
      expected === "application/json"
        ? contentType.includes("application/json") || contentType.includes("+json")
        : contentType.includes(expected)
    if (!matches) {
      add(
        "warning",
        "content_type_mismatch",
        `Content-Type (${contentType}) does not match body mode (${state.bodyMode}).`
      )
    }
  }
  if (state.bodyMode === "multipart_form" && contentType.includes("multipart/form-data")) {
    add(
      "warning",
      "multipart_content_type_manual",
      "Manual multipart/form-data header may break boundary handling; runtime usually sets this."
    )
  }

  const errors = items.filter((item) => item.severity === "error")
  const warnings = items.filter((item) => item.severity === "warning")
  return { items, errors, warnings, blockingErrors: errors }
}
