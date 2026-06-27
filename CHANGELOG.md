# Changelog

## Unreleased

### Changed

- Retired old public release branches/tags that still exposed the local-only `docs/` folder.
- Clarified public documentation policy in README/INSTALL.

## [1.13.5] - 2026-06-27

### Fixed

- Update UI no longer dead-ends when VS Code rejects automatic VSIX installation with errors such as `No Servers`.
- Downloaded update VSIX files now offer manual fallbacks: open the VSIX, reveal the downloaded file, copy the path, or open the GitHub Release.

## [1.13.4] - 2026-06-27

### Changed

- Removed long-form `docs/` planning files from public git tracking.
- Added `docs/` to `.gitignore` so future public source/release commits keep local docs private.
- Updated public README/INSTALL references to avoid links into local-only docs.

## [1.13.3] - 2026-06-27

### Improved

- Dependency Graph now has a richer visual layout with inbound/outbound grouping, stronger node cards, arrowed FK/view-reference edges, edge labels, and relation highlighting.
- Added node and edge detail panels for schema, inbound/outbound counts, related edges, source/target objects, and column mapping.

### Docs

- Updated dependency graph usage and design docs for the new visual/detail UI.

## [1.13.2] - 2026-06-26

### Fixed

- Schema tree no longer stays on `Loading...` indefinitely when database metadata is slow or the server/network hangs.
- Added `openDbNexus.metadata.loadTimeoutSeconds` to control how long the tree waits before showing a retryable timeout error.

### Docs

- Added troubleshooting notes for slow database metadata loading.

## [1.13.1] - 2026-06-26

### Added

- Update checker UI: **Open DB Nexus: Check for Updates** checks GitHub Releases, downloads the latest VSIX, and starts VS Code's install flow.
- Automatic startup update checks with `openDbNexus.updates.autoCheckOnStartup` and `openDbNexus.updates.checkIntervalHours`.

### Docs

- Updated install and usage docs so updates can be done from VS Code UI instead of terminal commands.

## [1.13.0] - 2026-06-26

### Added

- Analytics/lakehouse foundation for ClickHouse, Trino, and Presto through HTTP-SQL compatible metadata/query execution.
- Apache Doris compatibility through the MySQL adapter.
- Warehouse query guard foundation for large-query warning flows.

### Docs

- Marked Phase 24 implementation status in the roadmap and future-features backlog.

## [1.12.0] - 2026-06-26

### Added

- Cloud/serverless SQL foundation for Cloudflare D1 and Turso through HTTP-SQL compatible metadata/query execution.
- Azure SQL preset through the SQL Server adapter.
- CockroachDB, GaussDB, Kingbase, and Redshift compatibility adapters through the PostgreSQL adapter.

### Docs

- Marked Phase 23 implementation status in the roadmap and future-features backlog.

## [1.11.0] - 2026-06-25

### Release

- Consolidated the current implementation progress through Phase 22 into the GitHub release line.
- Includes the Phase 19-21 adapter foundations for DuckDB, MongoDB, and Oracle.
- Includes the Phase 22 transport planning foundation for SSH tunnel, SOCKS/HTTP proxy, Docker discovery, and JDBC bridge.

## [1.8.0] - 2026-06-25

### Added

- **DuckDB adapter foundation** with file-based connections, metadata, query runner, qmark placeholders, and read-only safety via the `readonly` tag.
- **MongoDB adapter foundation** with database/collection browsing, sample field inference, indexes, generated `SELECT`/`COUNT` bridge, and JSON filter queries.
- **Oracle adapter foundation** with schema/table/view metadata, columns, indexes, constraints, triggers, DDL, bind variables, and Oracle pagination contract.
- **Transport planning foundation** for SSH tunnel, SOCKS/HTTP proxy, Docker discovery, and JDBC bridge profile metadata.

### Changed

- Added `colon` placeholder support for Oracle-style bind variables.
- Updated roadmap, future-feature, and GitHub phase docs for phases 19-22.
- Switched DuckDB integration to `@duckdb/node-api` to avoid the deprecated `duckdb` package and keep audit clean.

## [1.7.2] - 2026-06-23

### Fixed

- **Connection tree loading** no longer blocks the explorer while old/slow databases load; schema branches now show a loading placeholder and refresh themselves when metadata arrives.

### Docs

- Re-track the design docs and update the GitHub phase/versioning plan for phases 18-24.

## [1.7.1] - 2026-06-21

### Fixed

- **Activity Bar logo** now uses a VS Code-friendly monochrome SVG, while the connection form keeps the color brand logo.
- **Editable table grid** actions are easier to discover: rows show edit/delete actions when a primary key exists, and new rows always show Save/Cancel.
- **Insert row on tables without a primary key** now works from the Data tab; update/delete remain primary-key guarded.
- Empty-string cells no longer get converted to `NULL` just by entering and leaving edit mode.

### Docs

- Added the GitHub CLI setup and release workflow for phase commits, push, tag, GitHub Release creation, and VSIX upload.

## [1.7.0] - 2026-06-21

### Added

- **Adapter contract test** — a shared suite asserts every adapter (SQLite, PostgreSQL, MySQL, MariaDB, SQL Server, Redis) declares a valid `dbType`, pagination/placeholder style, and implements the full `DatabaseAdapter` method set. Adding a new adapter that misses a method now fails the build.
- **Per-connection SSL/TLS** — the connection form has a "Use SSL/TLS" toggle (allowing self-signed certs), threaded into the PostgreSQL and MySQL/MariaDB drivers.

### Notes

- New engine adapters (MongoDB, DuckDB, Oracle), SSH tunnels and Marketplace publishing remain on the backlog: they pull in native/heavy dependencies that can't be verified in this environment and each deserves its own focused release (use the `db-adapter-builder` agent).

## [1.6.0] - 2026-06-21

### Added

- **Dangerous-SQL warning** — running `DROP`, `TRUNCATE`, or a `DELETE`/`UPDATE` without a `WHERE` clause from the query editor now prompts a modal confirmation first. Detection ignores keywords inside comments and string literals.
- **Global schema search** — right-click a connection → _Search Schema_ to find tables, views and columns by name (column scan capped at 150 tables) and open the match.
- **Result grid filter & sort** — the Query Result panel gained a live filter box and clickable, sortable column headers (numeric-aware).

### Notes

- Explain-plan visualizer, PNG graph export and procedure/trigger dependency graphs remain on the backlog.

## [1.5.0] - 2026-06-21

### Added

- **Security policies (hard enforcement)** — `openDbNexus.security.disableWriteOnProduction` and `openDbNexus.security.disableExportOnProduction` block writes/DDL and exports/backups on `production` connections outright (beyond the existing confirm prompt).
- **Logical backup** — right-click a connection → _Backup_ to dump table DDL + data as a single `.sql` file (no external tools like pg_dump/mysqldump required), with a progress notification. Honors the export policy.
- **Connection dashboard** — right-click a connection → _Open Dashboard_ for a card view of table/view counts and the server version.

### Notes

- Process/session monitor and a role/privilege editor remain on the backlog (engine-specific, higher risk).

## [1.4.0] - 2026-06-21

### Added

- **Mock data generator** — right-click a table → _Generate Mock Data_, enter a row count, and seeded, type-aware values are inserted (int, decimal, boolean, date/datetime, UUID, email, name, JSON, text). Integer primary keys are skipped (treated as auto-increment); nullable columns can receive NULL. Capped at 5k rows and guarded on production.
- **Code generators** — right-click a table → _Generate Code_ to produce a TypeScript interface, a C# entity class, or CRUD SQL (SELECT/INSERT/UPDATE/DELETE keyed by primary key), opened in a new editor.

### Internal

- Deterministic seeded PRNG (`mockData`) and `codeGen` builders, both unit-tested; `GeneratorService` ties them to the schema + edit services.

## [1.3.0] - 2026-06-21

### Added

- **Export** — export the current page or the whole table (capped at 50k rows) to CSV, JSON or SQL Insert from the Data tab; the Query Result panel can export its rows too.
- **CSV import** — import a CSV file into the open table: headers auto-map to columns (case-insensitive), empty cells become `NULL`, each row is a parameterized insert, and per-row errors are reported without aborting the rest. Capped at 10k rows per run.
- **Enhanced query history** — searchable history with favorites (kept beyond the retention limit), remove-one and clear-all actions, and a configurable retention limit (`openDbNexus.history.maxItems`).
- **Refreshed Query Result panel** — now uses the shared UI kit and gains the export toolbar.

### Notes

- XLSX import/export is intentionally deferred to avoid bundling a heavy spreadsheet dependency; CSV/JSON/SQL cover the common cases with zero new runtime deps.

## [1.2.0] - 2026-06-21

### Added

- **Object panel with tabs** — the table viewer is now a tabbed panel (Data · Columns · Constraints · Triggers · DDL) with a refreshed, theme-aware UI design kit shared across webviews.
- **Editable data grid** — double-click a cell to edit, add rows, and delete rows. All writes use parameterized statements (values bound via driver placeholders, never string-interpolated) and target rows by primary key.
- **Column DDL** — add/drop columns from the Columns tab with a SQL preview before running (dialect-aware: `ADD COLUMN` vs SQL Server `ADD`).
- **Properties introspection** — triggers and check constraints for SQLite, PostgreSQL, MySQL/MariaDB and SQL Server, plus existing columns/indexes/foreign keys and the object DDL, with paging and a page-size selector.
- **Production write guard** — writes/DDL on connections marked `production` require an explicit confirmation, and the panel shows a production banner.

### Internal

- `QueryOptions.params` + `DatabaseAdapter.placeholderStyle` thread parameterized values through every SQL adapter.
- New `rowMutation` builders (insert/update/delete by key, add/drop column) and `DataEditService`, both unit-tested.

## [1.1.0] - 2026-06-20

### Added

- **Redis adapter** (`redis`): connect + PING test, list keys (SCAN) as tree nodes, and run Redis commands through the Query Editor (`GET`, `SET`, `KEYS *`, …).
- `utils/commandTokenizer` (quote-aware) for parsing Redis commands.
- Docker Compose for a local Redis instance.
- Prioritized future roadmap notes for engines, Redis depth, schema/query/graph enhancements, generators, security, and UX.
- Tests for the Redis adapter and command tokenizer.

### Notes

- Redis is a key-value store: SQL-only features (paginated table viewer, dependency graph) do not apply. Use the Query Editor as a command console.

## [1.0.0] - 2026-06-20

### Added

- Phase 10 — first stable release.
- Comprehensive README (features, usage, security, ethical positioning, dev/VSIX guide).
- `THIRD_PARTY_NOTICES.md` listing bundled runtime drivers and licenses.
- VSIX packaging: `.vscodeignore`, `repository` metadata, and `npm run package:vsix` (`@vscode/vsce`).

### Highlights (since 0.0.1)

- Multi-database connection manager with secrets in VS Code SecretStorage.
- SQLite, PostgreSQL, MySQL/MariaDB, and SQL Server adapters.
- SQL query editor + result grid + query history.
- Table data viewer with pagination.
- Foreign-key dependency graph with view dependencies, cycle detection, and Markdown impact reports.

### Notes

- Demo GIF/screenshots and Marketplace publishing are pending (require a manual capture and a publisher token).
- Procedure/function/trigger dependency and PNG graph export remain deferred.

## [0.0.10] - 2026-06-20

### Added

- Phase 9 — Advanced dependency analysis.
- Circular dependency detection (DFS) — surfaced as a warning in the graph.
- Impact analysis: "Open Dependency Report" generates a Markdown report (depends on / depended on by / transitive impact / cycles).
- View dependency edges (PostgreSQL + SQL Server via `VIEW_TABLE_USAGE`) drawn as dashed `view_reference` edges; SQLite/MySQL return none.
- Export the graph as a standalone SVG file.
- `appendViewDependencies`, `detectCycles`, `buildImpactReport` in the graph builder (pure, tested).

### Notes

- Procedure/function/trigger dependency and PNG export are deferred (need procedure/trigger introspection and canvas rasterization).

## [0.0.9] - 2026-06-20

### Added

- Phase 8 — Dependency Graph MVP (the product's key differentiator).
- `graphBuilder` (pure): build a full FK graph and extract a subgraph by center/direction/depth.
- `DependencyGraphService`: assembles the schema-wide FK graph via the adapters.
- Dependency Graph webview (self-contained SVG — no external libraries, CSP-safe): radial layout, pan/zoom, search, double-click a node to open table data, Export JSON.
- Direction (inbound/outbound/both) and depth (1/2/3/all) controls; large-graph warning (>300 nodes).
- "Open Dependency Graph" command on a table's context menu.
- Tests for graphBuilder and DependencyGraphService.

## [0.0.8] - 2026-06-20

### Added

- Phase 7 — SQL Server adapter (mssql/tedious).
- `SqlServerAdapter`: connect, test, list schemas/tables/views/columns/indexes/foreign keys, DDL, execute query.
- `trustServerCertificate` enabled by default so local Docker (self-signed cert) works out of the box.
- Per-adapter pagination style: SQL Server uses `OFFSET … FETCH` (with `ORDER BY (SELECT NULL)`); others use `LIMIT … OFFSET`.
- Bracket identifier quoting (`[name]`) for SQL Server.
- Docker Compose + seed for a local SQL Server test database.
- Tests for SQL Server metadata mapping and offset-fetch pagination.

### Changed

- `DatabaseAdapter` gains a `paginationStyle` field; `buildSelectAll` honours it.
- `mssql` (and `tslib`) added as runtime dependencies (mssql externalized from the bundle).

## [0.0.7] - 2026-06-20

### Added

- Phase 6 — MySQL/MariaDB adapter (mysql2), registered for both `mysql` and `mariadb`.
- `MySqlAdapter`: connect, test, list schemas/tables/views/columns/indexes/foreign keys, DDL (SHOW CREATE), execute query.
- Per-dialect identifier quoting: `DatabaseAdapter.quoteIdentifier` (double-quote for SQLite/Postgres, backtick for MySQL) so the table viewer builds valid SQL for each engine.
- Docker Compose + seed for a local MySQL test database.
- Tests for MySQL metadata mapping and backtick pagination.

### Changed

- `adapters/common/pagination` now takes a quoting function instead of hard-coded double quotes.
- `mysql2` added as a runtime dependency (externalized from the esbuild bundle).

## [0.0.6] - 2026-06-20

### Added

- Phase 5 — PostgreSQL adapter (first async engine, node-postgres).
- `PostgresAdapter`: connect, test, list schemas/tables/views/columns/indexes/foreign keys, DDL, execute query.
- Schema layer in the tree: Connection → Schema → Tables/Views (SQLite still shows Tables/Views directly).
- Injectable pg client factory so the adapter is unit-tested without a live database.
- Docker Compose test database (`test/docker/`) with seed schema for manual testing.
- Tests for PostgresAdapter metadata mapping (schemas, columns/PK, FK + index grouping, query/affectedRows).

### Changed

- `DatabaseAdapter` gains `listSchemas` and optional schema arg on `listTables`/`listViews`.
- `pg` added as a runtime dependency (externalized from the esbuild bundle).

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

- `ConnectionProfile.driver` renamed to `dbType` to match the adapter contract.
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
