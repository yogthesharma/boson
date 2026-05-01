import type { PresetDefinition } from "@/api"
import type { RequestBodyMode, RequestTabState } from "./helpers"

export type PresetConflict = { field: string; before: string; after: string }

export type PresetApplyResult = {
  nextState: RequestTabState
  conflicts: PresetConflict[]
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  return JSON.stringify(value)
}

function bodyModeFromPreset(mode?: string): RequestBodyMode | null {
  if (
    mode === "none" ||
    mode === "json" ||
    mode === "xml" ||
    mode === "text" ||
    mode === "sparql" ||
    mode === "form_urlencoded" ||
    mode === "multipart_form" ||
    mode === "binary"
  ) {
    return mode
  }
  return null
}

function compareAndTrack(
  conflicts: PresetConflict[],
  field: string,
  before: unknown,
  after: unknown
) {
  const beforeText = stringifyValue(before)
  const afterText = stringifyValue(after)
  if (beforeText.length > 0 && beforeText !== afterText) {
    conflicts.push({ field, before: beforeText, after: afterText })
  }
}

export function applyPresetToRequestState(
  state: RequestTabState,
  preset: PresetDefinition
): PresetApplyResult {
  const conflicts: PresetConflict[] = []
  const next: RequestTabState = structuredClone(state)

  if (preset.headers) {
    const mergedHeaders = { ...Object.fromEntries(next.headers) }
    for (const [key, value] of Object.entries(preset.headers)) {
      compareAndTrack(conflicts, `headers.${key}`, mergedHeaders[key], value)
      mergedHeaders[key] = value
    }
    next.headers = Object.entries(mergedHeaders)
  }

  if (preset.auth) {
    const authType = preset.auth.type ?? next.auth.type
    if (authType) {
      compareAndTrack(conflicts, "auth.type", next.auth.type, authType)
      next.auth.type = authType
    }
    if (preset.auth.basic) {
      if (preset.auth.basic.username !== undefined) {
        compareAndTrack(
          conflicts,
          "auth.basic.username",
          next.auth.username,
          preset.auth.basic.username
        )
        next.auth.username = preset.auth.basic.username
      }
      if (preset.auth.basic.password !== undefined) {
        compareAndTrack(
          conflicts,
          "auth.basic.password",
          next.auth.password,
          preset.auth.basic.password
        )
        next.auth.password = preset.auth.basic.password
      }
    }
    if (preset.auth.bearer?.token !== undefined) {
      compareAndTrack(conflicts, "auth.bearer.token", next.auth.token, preset.auth.bearer.token)
      next.auth.token = preset.auth.bearer.token
    }
    if (preset.auth.api_key) {
      if (preset.auth.api_key.key !== undefined) {
        compareAndTrack(
          conflicts,
          "auth.api_key.key",
          next.auth.apiKeyName,
          preset.auth.api_key.key
        )
        next.auth.apiKeyName = preset.auth.api_key.key
      }
      if (preset.auth.api_key.value !== undefined) {
        compareAndTrack(
          conflicts,
          "auth.api_key.value",
          next.auth.apiKeyValue,
          preset.auth.api_key.value
        )
        next.auth.apiKeyValue = preset.auth.api_key.value
      }
      if (preset.auth.api_key.add_to !== undefined) {
        compareAndTrack(
          conflicts,
          "auth.api_key.add_to",
          next.auth.apiKeyAddTo,
          preset.auth.api_key.add_to
        )
        next.auth.apiKeyAddTo = preset.auth.api_key.add_to
      }
    }
  }

  if (preset.vars && preset.vars.length > 0) {
    const mergedVars = new Map(next.vars.map((item) => [item.key, item]))
    for (const variable of preset.vars) {
      const existing = mergedVars.get(variable.key)
      compareAndTrack(conflicts, `vars.${variable.key}`, existing?.value ?? "", variable.value)
      mergedVars.set(variable.key, {
        key: variable.key,
        value: variable.value,
        enabled: variable.enabled !== false,
      })
    }
    next.vars = Array.from(mergedVars.values())
  }

  if (preset.settings) {
    if (preset.settings.timeout_ms !== undefined) {
      compareAndTrack(
        conflicts,
        "settings.timeout_ms",
        next.settings.timeoutMs,
        String(preset.settings.timeout_ms)
      )
      next.settings.timeoutMs = String(preset.settings.timeout_ms)
    }
    if (preset.settings.follow_redirects !== undefined) {
      compareAndTrack(
        conflicts,
        "settings.follow_redirects",
        next.settings.followRedirects,
        preset.settings.follow_redirects
      )
      next.settings.followRedirects = preset.settings.follow_redirects
    }
    if (preset.settings.retry_count !== undefined) {
      compareAndTrack(
        conflicts,
        "settings.retry_count",
        next.settings.retryCount,
        String(preset.settings.retry_count)
      )
      next.settings.retryCount = String(preset.settings.retry_count)
    }
  }

  if (preset.body_config) {
    const mode = bodyModeFromPreset(preset.body_config.mode)
    if (mode) {
      compareAndTrack(conflicts, "body.mode", next.bodyMode, mode)
      next.bodyMode = mode
    }
    if (preset.body_config.raw !== undefined) {
      compareAndTrack(conflicts, "body.raw", next.bodyText, preset.body_config.raw)
      next.bodyText = preset.body_config.raw
    }
    if (preset.body_config.form_entries) {
      const formEntries = preset.body_config.form_entries.map((entry) => [
        entry.key,
        entry.value ?? "",
      ]) as Array<[string, string]>
      compareAndTrack(
        conflicts,
        "body.form_entries",
        next.bodyFormEntries.length,
        formEntries.length
      )
      next.bodyFormEntries = formEntries
    }
    if (preset.body_config.multipart_entries) {
      const multipartEntries = preset.body_config.multipart_entries.map((entry) => ({
        key: entry.key,
        value: entry.value ?? "",
        type: entry.type === "file" ? "file" : "text",
      }))
      compareAndTrack(
        conflicts,
        "body.multipart_entries",
        next.bodyMultipartEntries.length,
        multipartEntries.length
      )
      next.bodyMultipartEntries = multipartEntries
    }
    if (preset.body_config.binary_path !== undefined) {
      compareAndTrack(
        conflicts,
        "body.binary_path",
        next.bodyBinaryPath,
        preset.body_config.binary_path
      )
      next.bodyBinaryPath = preset.body_config.binary_path
    }
  }

  return { nextState: next, conflicts }
}
