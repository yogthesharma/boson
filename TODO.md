# Routepad MVP TODOs

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
- [ ] `routepad init` to scaffold `.api/`
- [ ] `routepad dev` to launch local UI server + watcher
- [ ] `routepad run <route-id>` to execute one route
- [ ] `routepad test` for suite execution

## 3) Local Server
- [ ] Implement `GET /health`
- [ ] Implement `GET /routes`
- [ ] Implement `GET /environments`
- [ ] Implement `POST /run/:route_id`
- [ ] Add file watch + live refresh events

## 4) UI (Read-Only + Actionable)
- [ ] Route list with groups/tags
- [ ] Request preview panel
- [ ] Run action + response viewer
- [ ] Environment switcher
- [ ] Last run history panel

## 5) Quality
- [ ] Add unit tests in `core` for parsing/validation/interpolation
- [ ] Add integration tests for server endpoints
- [ ] Add smoke test for `routepad dev`
- [ ] Add CI (`cargo test`, UI build, lint)

## 6) Scale-Ready Next
- [ ] Split runtime traits for local/cloud execution backends
- [ ] Add optional SQLite event store for local history
- [ ] Lock public API contracts for frontend portability
