# Changelog

## [0.0.5] - 2026-06-20

### Added

- Phase 4 — Query Editor.
- Open Query command (creates a SQL document bound to a connection); also from a connection's context menu.
- Run Query (Ctrl+Enter — selection or current statement) and Run All (Ctrl+Shift+Enter).
- Reusable Query Result grid webview (rows, duration, truncation, error state).
- Query history (globalState-backed) with a "Show Query History" picker to reopen past queries.
- Error normalization (`adapters/common/normalizeError`) — concise message + code.
- Basic query cancellation via progress notification + AbortSignal.
- Status bar item showing the SQL editor's bound connection (click to change).
- `utils/statementSplitter` (string/comment-aware) for selecting the statement to run.
- Tests for statementSplitter, normalizeError, QueryHistoryStore.

## [0.0.4] - 2026-06-20

### Added

- Phase 3 — SQLite Adapter (first real database engine).
- `DatabaseAdapter` interface + `AdapterRegistry` (adapter layer foundation).
- `SqliteAdapter` (better-sqlite3): connect, test, list tables/views/columns/indexes/foreign keys, DDL, execute query.
- `SessionManager` (connection pooling per profile), `SchemaService`, `QueryService`.
- Schema explorer tree: Connection → Tables/Views → Table → Columns/Indexes/Foreign Keys.
- Table Data viewer webview with pagination (Open Table Data).
- Tree "Test Connection" now performs a real connect for SQLite.
- `utils/sqlSafety` (identifier quoting) and `adapters/common/pagination`.
- Integration tests against real in-memory SQLite, plus registry/sql-safety/pagination unit tests.

### Changed

- `better-sqlite3` added as a runtime dependency (externalized from the esbuild bundle).

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
