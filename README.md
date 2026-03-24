# Boson

Boson is an open-source, local-first coding workbench focused on direct AI operator access from your own machine.

The goal is simple: developers should be able to use powerful coding operators without being locked into a single paid editor vendor.

## Why Boson

- Local-first architecture built on Tauri.
- Bring-your-own model provider and API key.
- Extensible workbench and contribution model.
- Open roadmap and open governance docs.

## Current Features

- VS Code-inspired workbench layout (titlebar, sidebar, editor, panel, status bar).
- Monaco-based code editor with tab management and save flows.
- Explorer and Open Editors views with rich interactions.
- Status bar telemetry (line/column, encoding, EOL, language).
- Tauri desktop runtime with file system and dialog integrations.

## Current Progress

- Workbench foundation is implemented and usable end-to-end.
- Explorer/Open Editors parity is partially complete, with rich context and rename flows in place.
- Bottom panel and status bar are mature for daily use, including persistence and editor telemetry.
- Extension contribution model (views, status bar, titlebar, commands) is active and extensible.
- AI operator layer is currently in planning/design docs and is the next major build phase.

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm
- Rust toolchain
- Tauri system prerequisites for your OS

### Run in development

```bash
pnpm install
pnpm tauri dev
```

### Build

```bash
pnpm tauri build
```

## Documentation

- Vision: `docs/vision.md`
- Architecture: `docs/architecture.md`
- Operator integration: `docs/operator-integration.md`
- Providers: `docs/providers.md`
- Privacy and data: `docs/privacy-and-data.md`
- Threat model: `docs/threat-model.md`
- Plugin SDK: `docs/plugin-sdk.md`
- Project roadmap: `docs/roadmap.md`
- FAQ: `docs/faq.md`
- Release process: `docs/release.md`

## Community

- Contributing guide: `CONTRIBUTING.md`
- Code of conduct: `CODE_OF_CONDUCT.md`
- Security policy: `SECURITY.md`
- License: `LICENSE`
