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
- [x] `boson init` to scaffold `.api/`
- [x] `boson dev` to launch local UI server + watcher
- [ ] `boson run <route-id>` to execute one route (currently validates/loads route only)
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
- [x] Add method + last-run status hints in sidebar route rows
- [x] Add search filters (method/group/failed-only) in command palette
- [x] Add compact environment indicator in sidebar footer
- [x] Persist collection/folder collapse state in local storage
- [x] Remove run controls from sidebar rows (run action stays in main request panel)
- [ ] Environment switcher
- [x] Last run history panel (Timeline tab with clear + local persistence)
- [x] Switch from fixed polling to SSE-driven live refresh (with polling fallback)

## 4.1) Collections and Folders
- [x] Infer top-level collections from `.api/routes/**` folder structure
- [x] Support nested folders in sidebar tree (`Users > Admin > ...`)
- [x] Keep compatibility for flat route files using `group` as fallback collection

## 5) Quality
- [ ] Add unit tests in `core` for parsing/validation/interpolation
- [ ] Add integration tests for server endpoints
- [ ] Add smoke test for `boson dev`
- [ ] Add CI (`cargo test`, UI build, lint)

## 7) Response Workbench (Completed in MVP)
- [x] Interactive JSON response viewer using Monaco (folding, line numbers, transparent background)
- [x] Custom in-editor search UI (open/find/next/prev/count/no-match state)
- [x] Capture and display response headers from backend execution
- [x] Header table improvements (scroll-fit layout, filter, copy visible rows)
- [x] Timeline table improvements (table-style parity with headers, clear action, persisted history)
- [x] Tests UI improvements (table-style results with PASS/FAIL badges + loading/empty states)
- [x] Extend route test engine: `status`, `header_exists`, `header_equals`, `body_path_exists`, `body_path_equals`, `response_time_ms`
- [x] Toolbar response metadata polish (status, duration, size, tests passed/total)

## 6) Scale-Ready Next
- [ ] Split runtime traits for local/cloud execution backends
- [ ] Add optional SQLite event store for local history
- [ ] Lock public API contracts for frontend portability
