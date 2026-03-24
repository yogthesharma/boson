# Plugin SDK

Boson exposes contribution points that allow extensions to add UI and behavior without forking core code.

## Contribution areas

- Workbench view containers
- Workbench views (primary sidebar, auxiliary bar, panel)
- Status bar items
- Titlebar contributions
- Commands

## Design rules

- Contributions must have stable IDs
- Ordering should be deterministic
- Unregister APIs should always be provided
- Extensions should degrade gracefully if dependencies are unavailable

## Minimal extension flow

1. Register command IDs
2. Register UI contributions that reference those commands
3. Subscribe to state if needed
4. Unregister on teardown

## Versioning

- Treat contribution type changes as API changes
- Document breaking changes clearly in release notes

## Future SDK docs

- End-to-end extension example
- Testing harness for extension contributions
- Compatibility matrix by Boson release
