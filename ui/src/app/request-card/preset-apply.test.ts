import assert from "node:assert/strict"
import test from "node:test"
import type { PresetDefinition } from "../../api"
import type { RequestTabState } from "./helpers"
import { applyPresetToRequestState } from "./preset-apply"

function makeState(): RequestTabState {
  return {
    method: "GET",
    url: "/users",
    params: [],
    headers: [["Accept", "application/json"], ["x-idempotency-key", "old-value"]],
    bodyMode: "none",
    bodyText: "",
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
    vars: [{ key: "tenant", value: "old", enabled: true }],
    script: { preRequest: "", postResponse: "" },
    docs: { summary: "", description: "" },
    file: { mode: "none", path: "", multipart: [] },
    settings: { timeoutMs: "", followRedirects: true, retryCount: "" },
  }
}

test("preset merge overwrites keys and tracks conflicts", () => {
  const preset: PresetDefinition = {
    id: "gateway-bearer",
    name: "Gateway Bearer",
    headers: {
      Authorization: "Bearer {{service_token}}",
      "x-idempotency-key": "new-value",
    },
    auth: {
      type: "bearer",
      bearer: { token: "{{service_token}}" },
    },
    settings: {
      timeout_ms: 3000,
      retry_count: 2,
    },
    vars: [{ key: "tenant", value: "new", enabled: true }],
  }

  const { nextState, conflicts } = applyPresetToRequestState(makeState(), preset)
  const headers = Object.fromEntries(nextState.headers)
  assert.equal(headers.Authorization, "Bearer {{service_token}}")
  assert.equal(headers["x-idempotency-key"], "new-value")
  assert.equal(nextState.auth.type, "bearer")
  assert.equal(nextState.auth.token, "{{service_token}}")
  assert.equal(nextState.settings.timeoutMs, "3000")
  assert.equal(nextState.settings.retryCount, "2")
  assert.equal(nextState.vars.find((v) => v.key === "tenant")?.value, "new")
  assert.ok(conflicts.some((item) => item.field === "headers.x-idempotency-key"))
  assert.ok(conflicts.some((item) => item.field === "vars.tenant"))
})

test("body template preset updates body mode and payload fields", () => {
  const preset: PresetDefinition = {
    id: "json-body",
    name: "JSON Body",
    body_config: {
      mode: "json",
      raw: '{"hello":"world"}',
    },
  }
  const { nextState } = applyPresetToRequestState(makeState(), preset)
  assert.equal(nextState.bodyMode, "json")
  assert.equal(nextState.bodyText, '{"hello":"world"}')
})
