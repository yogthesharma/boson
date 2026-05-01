import assert from "node:assert/strict"
import test from "node:test"
import type { RequestTabState } from "./helpers"
import { computeMissingEnvironmentVariables } from "./missing-vars"

function makeState(): RequestTabState {
  return {
    method: "GET",
    url: "/users/{{tenant}}?cursor={{cursor}}",
    params: [],
    headers: [["x-tenant", "{{tenant}}"], ["authorization", "Bearer {{token}}"]],
    bodyMode: "json",
    bodyText: '{"org":"{{tenant}}","region":"{{region}}"}',
    bodyFormEntries: [["q", "{{cursor}}"]],
    bodyMultipartEntries: [
      { key: "meta", value: "{{token}}", type: "text" },
      { key: "file", value: "", type: "file", fileName: "{{file_name}}" },
    ],
    bodyBinaryPath: "/tmp/{{tenant}}.bin",
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
    vars: [
      { key: "tenant", value: "{{tenant}}", enabled: true },
      { key: "feature", value: "{{feature_flag}}", enabled: true },
    ],
    script: { preRequest: "", postResponse: "" },
    docs: { summary: "", description: "" },
    file: { mode: "none", path: "", multipart: [] },
    settings: { timeoutMs: "", followRedirects: true, retryCount: "" },
  }
}

test("returns sorted missing variable keys only", () => {
  const state = makeState()
  const missing = computeMissingEnvironmentVariables(state, {
    tenant: "acme",
    cursor: "abc123",
    token: "secret",
  })
  assert.deepEqual(missing, ["feature_flag", "file_name", "region"])
})

test("handles empty state safely", () => {
  assert.deepEqual(computeMissingEnvironmentVariables(null, { tenant: "acme" }), [])
})
