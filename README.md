# Open DB Nexus

![CI](https://github.com/PiupiuTenshi/Database-Client/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/github/license/PiupiuTenshi/Database-Client)
![Last Commit](https://img.shields.io/github/last-commit/PiupiuTenshi/Database-Client)

A VS Code multi-database client with a schema explorer, SQL query runner, result grid, table viewer, and an interactive **dependency graph** for database objects.

> Open DB Nexus is an original open-source database client extension for VS Code.
> It is not affiliated with, derived from, or intended to bypass licensing of any existing database client extension.

## Features

- **Unlimited connection profiles** — no artificial limit on how many databases you can save.
- **Multi-database via an adapter architecture** — SQLite, PostgreSQL, MySQL/MariaDB, SQL Server, and Redis.
- **Connection manager** — create / edit / delete / test connections. Passwords are stored in VS Code `SecretStorage`, never in plaintext.
- **Schema explorer** — Connections → (Schema) → Tables / Views → Columns / Indexes / Foreign Keys.
- **Query editor** — open a SQL document bound to a connection, run the selection or the current statement (`Ctrl+Enter`) or the whole file (`Ctrl+Shift+Enter`), with a result grid and query history.
- **Table data viewer** — paginated browsing of any table.
- **Dependency Graph** — visualize foreign-key relationships between tables (inbound / outbound / both, depth 1/2/3/all), search nodes, open a table from the graph, and export the graph as JSON or SVG.
- **Advanced dependency analysis** — view dependencies (PostgreSQL / SQL Server), circular-dependency detection, and a Markdown impact report.

## Supported databases

| Engine          | Driver           | Status                      |
| --------------- | ---------------- | --------------------------- |
| SQLite          | `better-sqlite3` | ✅                          |
| PostgreSQL      | `pg`             | ✅                          |
| MySQL / MariaDB | `mysql2`         | ✅                          |
| SQL Server      | `mssql`          | ✅                          |
| Redis           | `redis`          | ✅ (keys + command console) |
| MongoDB         | —                | planned                     |

> **Redis** is a key-value store, not SQL: use the **Query Editor** to run commands (`SET`, `GET`, `KEYS *`, …); keys are listed under "Tables". SQL-only features (paginated table viewer, dependency graph) do not apply to Redis.

## Getting started

1. Open the **Open DB Nexus** view from the Activity Bar.
2. Click **＋ Add Connection**, fill in the form, and **Test Connection**.
3. Expand the connection to browse the schema; right-click a table for **Open Table Data**, **Open Dependency Graph**, or **Open Dependency Report**.
4. Right-click a connection → **Open Query Editor**, write SQL, and press `Ctrl+Enter`.

### Keyboard shortcuts

| Shortcut           | Action                             |
| ------------------ | ---------------------------------- |
| `Ctrl+Enter`       | Run selection or current statement |
| `Ctrl+Shift+Enter` | Run the whole SQL file             |

## Security

- Passwords are stored only in VS Code `SecretStorage` — never in `globalState`, settings, files, logs, webviews, or query history.
- Secrets are masked before any logging (`utils/maskSecret`).
- Webviews use a strict Content-Security-Policy with a per-render nonce and receive no secrets.

See [`SECURITY.md`](SECURITY.md) and [`docs/07-security-license-and-ethics.md`](docs/07-security-license-and-ethics.md).

## Development

```bash
npm install
npm run check        # compile + lint + test + bundle (same as CI)
```

Press `F5` in VS Code to launch the Extension Development Host.

> **Native modules:** `better-sqlite3` is a native module. If you hit a `NODE_MODULE_VERSION` error in the Extension Development Host, rebuild it for VS Code's Electron runtime:
>
> ```bash
> npx @electron/rebuild -f -w better-sqlite3
> ```

Local test databases (Docker) for PostgreSQL / MySQL / SQL Server are in [`test/docker/`](test/docker/README.md).

### Build a VSIX

```bash
npm run package:vsix   # produces open-db-nexus-<version>.vsix
code --install-extension open-db-nexus-<version>.vsix
```

## Scripts

```txt
npm run compile      Type-check TypeScript.
npm run lint         Run ESLint.
npm test             Run Vitest tests.
npm run package      Build the production extension bundle.
npm run package:vsix Build a .vsix package.
npm run format       Format files with Prettier.
npm run check        compile + lint + test + package.
```

## Documentation

Product and architecture docs live in [`docs/`](docs/README.md).

## License

[MIT](LICENSE)
