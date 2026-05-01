# Boson

Boson is a repo-native API workspace where `.api/` JSON files are the source of truth and the UI acts as a Postman/Bruno-style execution workbench.

## Why Boson

- Config-first routes and environments live in your repo under `.api/`.
- Rich request editing in UI with local draft overrides (no accidental file writes).
- Run history behaves like first-class platform runs with `run_id`, detail lookup, and rerun.
- Route config is schema-validated on load for safer onboarding and fewer runtime surprises.
- Environment switching is UI-driven, but environment definitions remain config-authored.

## Project Structure

- `crates/core`: schema, loading, execution primitives
- `crates/server`: local HTTP server for UI + runtime APIs
- `crates/cli`: command entrypoint (`init`, `dev`, `run`)
- `ui`: browser workbench for request editing, execution, and inspection

## Local Development

```bash
cargo run -p boson-cli -- dev
```

This starts:

- local API server on `127.0.0.1:8787`
- UI dev server on `http://localhost:5173`

## Runtime APIs

- `GET /api/routes` - list route definitions from `.api/routes`
- `GET /api/environments` - list environment definitions
- `GET /api/presets` - list reusable preset snippets from `.api/presets`
- `POST /api/run/:route_id` - execute a route with optional draft overrides
- `GET /api/runs` - list persisted run summaries
- `GET /api/runs/:run_id` - fetch full run detail
- `POST /api/runs/:run_id/re-run` - rerun using the same stored payload
- `GET /api/events` - SSE stream for workspace changes

Environment CRUD endpoints are intentionally not exposed. Edit `.api/environments/*.json` directly and let watcher/SSE reload changes into the UI.

## Route Schema and Validation

Route files are validated against the embedded JSON schema at load time.

- Schema file: `crates/core/src/route.schema.json`
- Field guide: `.api/ROUTE_SCHEMA.md`

Validation failures include the offending route file path to speed up fixes.

## Current Product Capabilities

- Request bar edits (method/url) with reset-to-default behavior
- Params/Headers table + bulk editing with polished row interactions
- Auth, vars, scripts, docs, file, and settings tabs (config-first defaults)
- Response inspection tabs for payload, headers, timeline, and tests
- Run timeline with rerun action backed by server-side run history
- Environment selector in UI with config-first source of truth (`.api/environments/*.json`)
- Runtime `{{var}}` substitution across path, headers, and body flows
- Missing environment variable warning in request bar before run
- Config-first presets tab for applying reusable auth/header/body/settings snippets

## Environment Model

- Source of truth: `.api/environments/*.json`
- UI responsibility: select active environment and preview run behavior
- File edits auto-sync into UI via watcher + SSE
- Secrets can be represented in environment config using `secret_keys`; UI treats env values as config data, not mutable state

## Presets Model

- Source of truth: `.api/presets/*.json`
- Runtime API: `GET /api/presets`
- UI: Presets tab applies snippets to **draft only** (no file writes)
- Reset to default removes all draft-applied preset changes
- Merge behavior:
  - headers/vars/settings/auth/body template values are merged into current draft
  - matching keys are overwritten (conflicts shown as overwrite preview)
  - non-matching keys are added

Example presets:

- `bearer-service` for standard bearer auth + service headers
- `json-defaults` for JSON headers + body template
- `retry-strict` for timeout/retry settings profile

## Status

Boson now ships an end-to-end local platform demo loop: configure in `.api`, run from UI, inspect history, rerun with the same payload, and iterate safely.
