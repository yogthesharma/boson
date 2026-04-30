# Boson MVP TODOs

## 0) Foundation (now)
- [x] Create modular workspace (`core`, `server`, `cli`, `ui`)
- [x] Define starter API domain models
- [x] Add placeholder local server and CLI entrypoints
- [x] Keep interfaces stable for cloud evolution

## 1) File Schema + Validation
- [ ] Add `schemaVersion` and strict validation rules
- [ ] Add route IDs and uniqueness checks
- [ ] Add deterministic variable interpolation order
- [ ] Add JSON schema docs + examples

## 2) CLI
- [ ] `boson init` to scaffold `.api/`
- [ ] `boson dev` to launch local UI server + watcher
- [ ] `boson run <route-id>` to execute one route
- [ ] `boson test` for suite execution

## 3) Local Server
- [x] Implement `GET /health`
- [x] Implement `GET /routes`
- [x] Implement `GET /environments`
- [x] Implement `POST /run/:route_id`
- [x] Add file watch + live refresh events
- [x] Add `GET /api/events` SSE stream for UI live sync

## 4) UI (Read-Only + Actionable)
- [x] Route list with groups/tags
- [x] Request preview panel
- [x] Run action + response viewer
- [x] Add route search in sidebar
- [x] Replace sidebar text search with command palette trigger
- [x] Improve sidebar brand anchor (logo scale + title weight)
- [x] Convert request details to 2-column definition layout
- [x] Add response empty/skeleton states for clearer UX
- [ ] Environment switcher
- [ ] Last run history panel
- [x] Switch from fixed polling to SSE-driven live refresh (with polling fallback)

## 5) Quality
- [ ] Add unit tests in `core` for parsing/validation/interpolation
- [ ] Add integration tests for server endpoints
- [ ] Add smoke test for `boson dev`
- [ ] Add CI (`cargo test`, UI build, lint)

## 6) Scale-Ready Next
- [ ] Split runtime traits for local/cloud execution backends
- [ ] Add optional SQLite event store for local history
- [ ] Lock public API contracts for frontend portability
