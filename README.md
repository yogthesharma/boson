# Boson

Repo-native API workspace where `.api/` JSON files are the source of truth.

## Architecture

- `crates/core`: schema, loading, execution primitives
- `crates/server`: local HTTP server for UI + runtime APIs
- `crates/cli`: command entrypoint (`init`, `dev`, `run`)
- `ui`: local browser app (read-only + actionable)

## Current Status

This repository is scaffolded for local-first MVP development with a modular layout designed for future cloud reuse.

## Next Step

Follow `TODO.md` from top to bottom.
