# Contributing to Boson

Thanks for your interest in contributing.

## Development setup

1. Install prerequisites:
   - Node.js 20+
   - pnpm
   - Rust toolchain
   - Tauri OS prerequisites
2. Install dependencies:
   - `pnpm install`
3. Run the app:
   - `pnpm tauri dev`

## Contribution workflow

1. Open an issue first for non-trivial changes.
2. Create a focused branch from `main`.
3. Keep PRs small and scoped.
4. Include screenshots or recordings for UI changes.
5. Add or update docs when behavior changes.

## Code style

- Use TypeScript and strict typing patterns.
- Prefer small, composable React components.
- Keep command IDs and registry IDs stable.
- Follow existing naming and file organization patterns.

## Testing checklist

Before opening a PR:

- Verify app boots with `pnpm tauri dev`.
- Verify build succeeds with `pnpm build`.
- Test key affected user flows.
- Confirm no obvious regressions in workbench layout.

## Commit messages

- Use clear, descriptive commit titles.
- Explain why the change was made, not just what changed.
