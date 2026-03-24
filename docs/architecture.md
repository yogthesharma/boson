# Architecture

## High-level stack

- Desktop shell: Tauri v2 (`src-tauri`)
- UI runtime: React + TypeScript (`src`)
- Editor: Monaco
- Styling: Tailwind CSS

## Frontend composition

`src/main.tsx` composes providers in this order:

1. `ThemeProvider`
2. `WorkspaceProvider`
3. `WorkbenchProvider`
4. `EditorSessionProvider`
5. `TitlebarExtensionProvider`

The top-level app renders:

- `Titlebar`
- `WorkbenchLayout`

## Core subsystems

### Workbench

Workbench state controls visibility and activity:

- Primary sidebar
- Auxiliary bar
- Bottom panel
- Active activity container

The workbench registry model supports contributions for:

- View containers
- Views
- Status bar items

### Commands

A lightweight command service maps command IDs to handlers and allows UI contributions to trigger shared behavior.

### Editor session

Editor session owns:

- Open tabs and active tab
- Monaco model lifecycle
- Dirty state and save operations
- Cursor telemetry and language metadata

### Workspace

Workspace context tracks current root path and recent projects, and opens folders through the Tauri dialog plugin.

## Tauri layer

`src-tauri` hosts desktop configuration, capabilities, and runtime plugins (filesystem, dialog, opener).
