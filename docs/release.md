# Release Process

## Versioning

Use semantic versioning:

- MAJOR for incompatible API changes
- MINOR for backward-compatible functionality
- PATCH for backward-compatible fixes

## Release checklist

1. Confirm build passes on supported platforms
2. Update docs for user-visible changes
3. Prepare changelog entries
4. Tag release in git
5. Publish release artifacts

## Changelog guidance

Group notes by:

- Features
- Fixes
- Breaking changes
- Docs and developer experience

## Desktop packaging notes

- Validate Tauri bundle configuration
- Verify signing/notarization requirements per platform
- Smoke test installers before public release
