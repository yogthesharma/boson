# Privacy and Data

Boson is designed as a local-first workbench.

## Data handling principles

- Keep workspace data local by default
- Minimize data sent to external providers
- Make external data flow explicit and user-controlled

## Local data

Potential local data includes:

- Workspace paths and recents
- Editor state and open buffers
- UI preferences and persisted layout settings

## External data

When using remote AI providers, request payloads may include:

- Prompt text
- Selected code context
- Tool-call metadata

Users should be informed clearly before external transmission.

## Logging recommendations

- Keep logs local by default
- Avoid logging secrets or full sensitive file contents
- Provide a clear way to purge local logs/state

## Configuration transparency

Document all provider-related environment variables and defaults in `docs/providers.md`.
