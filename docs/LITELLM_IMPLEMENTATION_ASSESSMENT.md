# LiteLLM Optional Gateway – Implementation Assessment

**Verdict: Yes, we can implement this.** The plan fits the current architecture with no breaking changes. Most resilience work (optional auth, manual model fallback, error surfacing) is already in place.

---

## Already in place (no change needed)

| Plan requirement | Current state |
|------------------|----------------|
| **fetchModels**: optional API key, Bearer only when key exists | Done in `endpoints.js` (lines 99–105): headers built conditionally; no key → no Authorization. |
| **fetchModels**: parse `data` / `models` / root array | Done (lines 119–125). LiteLLM-style responses are covered. |
| **Manual model ID fallback** in Chat/Voice/Image add flows | Present in all three sections; add works when fetch fails or returns empty. |
| **Section fetch errors** surfaced (toast + inline state) | `addModelFetchError` + toast in SettingsConfiguration; manual add still allowed. |
| **Default chat reassignment** when purpose changes away from chat | Handled in `models.js` `updateModel`. |
| **Endpoint deletion** cleans models, selections, keychain | Handled in `endpoints.js` `deleteEndpoint`. |
| **Base URL normalization** (trailing slash) | Done in `createEndpoint` and `updateEndpoint`. |
| **No IPC signature changes** | Plan does not require any. |
| **No schema migration** | New preset is additive; existing records stay valid. |

---

## Changes required

### 1. Backend

| File | Change |
|------|--------|
| **`main/services/validation.js`** | Add `"litellm"` to `PRESETS` array (line 1). |
| **`main/services/endpoints.js`** | Add `litellm: "http://localhost:4000"` to `PRESET_URLS`. In `testConnection`, build headers conditionally (like `fetchModels`): only send `Authorization` when key exists; keep 401/403 → "Invalid API key", 404 → "Endpoint not found". |
| **`main/services/chatClient.js`** | Make API key optional: do not return `MISSING_API_KEY` when key is empty. Build request headers with `Authorization` only when key exists. On 401/403, return `INVALID_API_KEY`. Chat then works for LiteLLM/local with or without key. |

### 2. Frontend

| File | Change |
|------|--------|
| **`SettingsConfiguration.jsx`** | Add LiteLLM to `PROVIDERS`: `id: "litellm"`, `name: "LiteLLM"`, `description: "Single gateway for multiple model providers"`, `preset: "litellm"`, `baseUrl: "http://localhost:4000"`, `needsApiKey: false`, `keyPlaceholder: "Optional unless proxy requires auth"`. Add a flag e.g. `apiKeyOptional: true` so the wizard shows the API key field with helper text but does not require it. In the connect wizard: when `apiKeyOptional` is true, show the key input (same as needsApiKey) with the optional placeholder; in `handleConnect`, do not require key for that provider (already satisfied if needsApiKey is false). Save key when non-empty; `testConnection` will work without key after backend change. |

### 3. UX copy (optional polish)

- In section add flow, you can distinguish “No models returned” (fetch succeeded but list empty) vs “Could not fetch models” (fetch failed). Current “No models found for this provider” and `addModelFetchError` already cover the main cases; this is a small wording improvement.

---

## Edge cases (plan vs code)

| Edge case | Status |
|-----------|--------|
| LiteLLM requires auth, user leaves key empty | After change: test returns 401/403 → “Invalid API key”; user adds key and retries. |
| LiteLLM open proxy, no auth | testConnection/fetchModels/chat use no header; backend already supports no-key for fetch; chat and test need the changes above. |
| `/models` disabled or fails | Fetch error shown; manual model ID still available. Already implemented. |
| Nonstandard model payload | Existing parsing falls back to empty list; manual add available. |
| Duplicate endpoints same URL | Allowed today; no change. |
| Existing non-LiteLLM endpoints | No code path change for other presets; behavior unchanged. |

---

## Implementation order

1. **Validation** – Add `litellm` to `PRESETS` in `validation.js`.
2. **Endpoints** – Add `litellm` to `PRESET_URLS`; make `testConnection` use optional auth (conditional headers).
3. **Chat client** – Optional auth: conditional `Authorization`, no `MISSING_API_KEY` when key empty.
4. **Frontend** – Add LiteLLM provider and optional-key wizard behavior (`apiKeyOptional` + copy).
5. **Smoke test** – Connect LiteLLM with and without key; add model (dropdown or manual); send chat.

---

## Risk and scope

- **Risk:** Low. All changes are additive or “allow one more case” (optional key).
- **Regression:** Existing providers only use existing presets and key-required paths; no change for them.
- **Out of scope (per plan):** LiteLLM routing/aliases/budgets UI, streaming protocol changes, schema changes.

---

## Summary

The plan is implementable as-is. Backend needs: one new preset, optional auth in `testConnection` and `chatClient`, and the existing optional auth in `fetchModels` and manual model fallback already satisfy the rest. Frontend needs: one new provider entry and optional-key UI for the connect wizard. No breaking changes and no migration.
