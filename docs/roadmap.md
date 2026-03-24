# Public Roadmap

This roadmap tracks major project goals for open-source Boson.

## Current Progress Snapshot

### Completed foundation

- Tauri + React + Monaco desktop workbench is running.
- Core layout surfaces are in place: titlebar, sidebars, editor, panel, status bar.
- Workspace open flow and local file read/write flows are implemented.
- Contribution registries for workbench/titlebar/status and command wiring are active.

### Substantial progress

- Explorer and Open Editors include advanced interactions (sorting, rename, context actions, dirty-state handling).
- Bottom panel supports tabs, resizing, and persisted state.
- Status bar provides dynamic editor metadata and contribution-based item rendering.

### In progress or next

- Full accessibility parity and large-tree performance paths.
- Deeper SCM and diagnostics integrations.
- AI operator execution stack (provider adapters, orchestration, safety approvals, and UX wiring).

## Near term

- Stabilize workbench UX parity for core IDE surfaces
- Improve explorer scalability and accessibility
- Complete panel/status overflow and visibility rules

## Operator platform

- Provider abstraction and configuration UX
- Streaming chat and operator command wiring
- Tool-call approval and safety controls
- Multi-provider routing support

## Collaboration and OSS readiness

- Improve contributor onboarding
- Add CI checks and release automation
- Expand docs with examples and architecture diagrams

## Security and trust

- Harden permission boundaries
- Improve auditability of operator actions
- Expand threat-model-driven testing
