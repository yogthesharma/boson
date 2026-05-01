import assert from "node:assert/strict"
import test from "node:test"
import type { RequestTabState } from "./helpers"
import {
  computeRequestDiagnostics,
  shouldShowDiagnosticsTab,
  DEFAULT_DIAGNOSTIC_RULE_TOGGLES,
} from "./diagnostics"

function baseState(): RequestTabState {
  return {
    method: "POST",
    url: "/users",
    params: [],
    headers: [],
    bodyMode: "json",
    bodyText: '{"ok":true}',
    bodyFormEntries: [],
    bodyMultipartEntries: [],
    bodyBinaryPath: "",
    bodyBinaryFileName: "",
    bodyBinaryBase64: "",
    assertions: [],
    auth: {
      type: "none",
      username: "",
      password: "",
      token: "",
      apiKeyName: "",
      apiKeyValue: "",
      apiKeyAddTo: "header",
    },
    vars: [],
    script: { preRequest: "", postResponse: "" },
    docs: { summary: "", description: "" },
    file: { mode: "none", path: "", multipart: [] },
    settings: { timeoutMs: "", followRedirects: true, retryCount: "" },
  }
}

test("creates blocking error for invalid json body", () => {
  const state = { ...baseState(), bodyText: "{invalid-json" }
  const result = computeRequestDiagnostics(state, [])
  assert.ok(result.errors.some((item) => item.code === "body_json_invalid"))
  assert.ok(result.blockingErrors.length > 0)
})

test("warns for content-type mismatch", () => {
  const state = {
    ...baseState(),
    headers: [["Content-Type", "text/plain"]],
  }
  const result = computeRequestDiagnostics(state, [])
  assert.ok(result.warnings.some((item) => item.code === "content_type_mismatch"))
})

test("treats sensitive missing variables as blocking", () => {
  const result = computeRequestDiagnostics(baseState(), ["api_token", "region"])
  assert.ok(result.errors.some((item) => item.code === "missing_sensitive_vars"))
  assert.ok(result.warnings.some((item) => item.code === "missing_vars"))
})

test("flags auth conflicts and incomplete auth payload", () => {
  const state = {
    ...baseState(),
    auth: {
      ...baseState().auth,
      type: "bearer" as const,
      token: "",
    },
    headers: [["Authorization", "Bearer custom"]],
  }
  const result = computeRequestDiagnostics(state, [])
  assert.ok(result.errors.some((item) => item.code === "auth_bearer_incomplete"))
  assert.ok(result.warnings.some((item) => item.code === "auth_header_conflict"))
})

test("diagnostics tab visibility toggles by presence of diagnostics", () => {
  const noIssues = computeRequestDiagnostics(baseState(), [])
  assert.equal(shouldShowDiagnosticsTab(noIssues), false)
  const withIssues = computeRequestDiagnostics(
    { ...baseState(), bodyText: "{bad json" },
    []
  )
  assert.equal(shouldShowDiagnosticsTab(withIssues), true)
})

test("diagnostics rule toggles can disable checks for future advanced mode", () => {
  const noAuthChecks = computeRequestDiagnostics(
    {
      ...baseState(),
      auth: { ...baseState().auth, type: "bearer", token: "" },
    },
    [],
    { ...DEFAULT_DIAGNOSTIC_RULE_TOGGLES, authChecks: false }
  )
  assert.ok(!noAuthChecks.errors.some((item) => item.code === "auth_bearer_incomplete"))
})
