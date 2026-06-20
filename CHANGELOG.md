# Changelog

## [0.0.3] - 2026-06-20

### Added

- Phase 2 — Connection Manager.
- Full `ConnectionProfile` (dbType, host/port/user/database, filePath, environment, tags, timestamps).
- `ProfileStore` (persists metadata in globalState) and `SecretStore` (passwords in SecretStorage).
- Connection form webview (CSP + nonce) for create/edit, with Test Connection.
- Commands: Add / Edit / Test / Delete (with confirm) / Refresh.
- `LogService` (Output channel) and `maskSecret` util — secrets never logged in plaintext.
- Production environment shown with a warning icon in the tree.
- Unit tests for maskSecret, objectId, ProfileStore, SecretStore, ConnectionService.

### Changed

- `ConnectionProfile.driver` renamed to `dbType` to match the adapter contract (docs/04).
- Connections are now persisted instead of seeded mocks.

## [0.0.2] - 2026-06-20

### Added

- Phase 1 — VS Code Shell.
- Activity Bar container "Open DB Nexus".
- "Connections" TreeView with mock connection nodes (seeded on activation).
- Commands: Add Connection, Refresh Connections, Remove Connection.
- View title actions (add/refresh) and inline context menu (remove).
- Status bar item showing the connection count.
- `ConnectionService` (in-memory mock store) with unit tests.
- Vitest `vscode` module mock for testing extension-host code.

## [0.0.1] - 2026-06-17

### Added

- Initial VS Code extension scaffold.
- Hello World command.
- TypeScript, esbuild, ESLint, Prettier, and Vitest setup.
- Basic CI workflow.
- Project documentation folder.
