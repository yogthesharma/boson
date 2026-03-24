# Operator Integration

This document defines how Boson should integrate AI operators safely and extensibly.

## Goals

- Allow direct calls to operators from the local machine
- Support both local and remote providers
- Keep provider APIs abstracted behind a stable interface

## Integration model

Recommended layers:

1. UI trigger layer (commands, chat, inline actions)
2. Operator orchestration layer (request shaping, tool routing, retries)
3. Provider adapter layer (OpenAI-compatible, local server, custom endpoint)
4. Safety layer (permission checks, path scoping, command controls)

## Core interface (conceptual)

- `listModels()`
- `sendPrompt(input, context)`
- `streamResponse(...)`
- `invokeTool(...)`
- `cancelRun(runId)`

## Safety boundaries

- Require explicit user intent for write or shell actions
- Show tool-call previews before execution when possible
- Restrict filesystem and command scope to workspace-allowed paths
- Log operator actions transparently

## Initial milestones

1. Single-provider text completion
2. Streaming responses in chat panel
3. Tool-call orchestration with approval model
4. Multi-provider routing
