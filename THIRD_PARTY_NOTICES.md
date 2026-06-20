# Third-party Notices

Open DB Nexus bundles the following open-source runtime dependencies. Each is the
property of its respective authors and used under its own license.

## better-sqlite3

License: MIT
Usage: SQLite adapter (connection, schema introspection, query execution).

## pg (node-postgres)

License: MIT
Usage: PostgreSQL adapter.

## mysql2

License: MIT
Usage: MySQL / MariaDB adapter.

## mssql

License: MIT
Usage: SQL Server adapter (uses `tedious` under the hood).

## tedious

License: MIT
Usage: Transitive dependency of `mssql` (SQL Server TDS driver).

## tslib

License: 0BSD
Usage: Runtime helpers required by Azure SDK packages pulled in via `tedious`.

---

Development-only dependencies (TypeScript, ESLint, Prettier, Vitest, esbuild,
@vscode/vsce, type definitions) are listed under `devDependencies` in
`package.json` and are not shipped in the published extension.
