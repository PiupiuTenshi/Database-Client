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
- **Object panel with tabs** — Data (editable), Columns, Constraints, Triggers and DDL in one tabbed view with a refreshed, theme-aware UI.
- **Editable data grid** — action buttons and double-click editing, add rows, delete keyed rows, add/drop columns with a DDL preview. Updates/deletes are primary-key guarded; inserts work even before a key exists.
- **Import / export** — export the page or whole table to CSV / JSON / SQL Insert (and from the Query Result panel); import a CSV file with header auto-mapping.
- **Mock data & code generators** — seeded, type-aware mock rows, plus TypeScript / C# / CRUD SQL generated from a table.
- **Database manager** — logical SQL backup (DDL + data), a connection dashboard, and global schema search (tables / views / columns).
- **Safety** — production write/export confirmation, hard-block policies (`disableWriteOnProduction` / `disableExportOnProduction`), and a destructive-SQL warning (DROP / TRUNCATE / DELETE|UPDATE without WHERE).
- **Query editor** — run the selection, the current statement (`Ctrl+Enter`) or the whole file (`Ctrl+Shift+Enter`); result grid with live filter and sortable columns; searchable, favorite-able query history.
- **Dependency Graph** — visualize foreign-key relationships (inbound / outbound / both, depth 1/2/3/all), search nodes, open a table from the graph, export as JSON or SVG, plus circular-dependency detection and a Markdown impact report.
- **Per-connection SSL/TLS** — toggle TLS (allowing self-signed certs) for PostgreSQL and MySQL/MariaDB.

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

See [`SECURITY.md`](SECURITY.md).

## Installation

### Install from GitHub Releases

1. Download `open-db-nexus-<version>.vsix` from the latest GitHub Release.
2. Install it from the terminal:

   ```powershell
   code --install-extension .\open-db-nexus-<version>.vsix
   ```

3. Reload VS Code if prompted.
4. Open **Open DB Nexus** from the Activity Bar.

You can also install through VS Code: **Extensions** → `...` → **Install from VSIX...**.

### Run from source

```bash
npm install
npm run compile
```

Open this repository in VS Code and press `F5` to launch an Extension Development Host.

If SQLite fails with a native module ABI error inside VS Code, rebuild `better-sqlite3` for VS Code's Electron runtime:

```bash
npx @electron/rebuild -f -w better-sqlite3
```

## How To Use

### Add a connection

1. Open the **Open DB Nexus** Activity Bar view.
2. Click **Add Connection**.
3. Choose a database type.
4. Fill in the connection fields.
5. Click **Test Connection**.
6. Click **Save**.

Passwords are stored in VS Code `SecretStorage`, not in files or settings.

### Browse schema

Expand a saved connection to view schemas, tables, views, columns, indexes, and foreign keys.

Useful table actions:

- **Open Table (Data & Properties)**: view paginated data and object metadata.
- **Open Dependency Graph**: visualize foreign-key dependencies.
- **Open Dependency Report**: generate a Markdown impact report.
- **Generate Code**: create TypeScript, C#, or CRUD SQL snippets.
- **Generate Mock Data**: insert seeded mock rows.

### Edit table data

Open a table with **Open Table (Data & Properties)**, then use the **Data** tab.

- Click the edit action or double-click a cell to edit.
- Click **Add row** to insert a row.
- Use the delete action to remove a row.
- Updates and deletes require a primary key so the extension can target one row safely.
- Inserts are allowed even when the table does not have a primary key.

All insert/update/delete values are passed through driver parameters; table and column names are quoted by the adapter.

### Import and export

From the Data tab:

- Export the current page or all rows as CSV, JSON, or SQL Insert.
- Import CSV with header auto-mapping.

From the Query Result panel:

- Filter rows.
- Sort columns.
- Export query results.

### Run SQL

Right-click a connection and choose **Open Query Editor**.

Shortcuts:

| Shortcut           | Action                             |
| ------------------ | ---------------------------------- |
| `Ctrl+Enter`       | Run selection or current statement |
| `Ctrl+Shift+Enter` | Run the whole SQL file             |

Dangerous statements such as `DROP`, `TRUNCATE`, or `DELETE`/`UPDATE` without `WHERE` prompt before running.

### Production safety

Set a connection environment to `production` to enable extra warnings. These settings can hard-block risky operations:

- `openDbNexus.security.disableWriteOnProduction`
- `openDbNexus.security.disableExportOnProduction`

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

## Release Workflow

Install GitHub CLI if needed:

```powershell
winget install --id GitHub.cli
gh auth login
gh auth status
```

Prepare a patch release:

```bash
npm version <version> --no-git-tag-version
npm run check
npm run package:vsix
git add .
git commit -m "build(release): prepare v<version>"
git tag v<version>
git push origin main --tags
```

Create a GitHub Release and upload the VSIX:

```powershell
gh release create v<version> .\open-db-nexus-<version>.vsix --title "Open DB Nexus v<version>" --notes-file CHANGELOG.md
```

## Repository Notes

The `docs/` folder is intentionally ignored. Keep long-form planning notes local and put user-facing setup, usage, development, and release instructions in this README.

## License

[MIT](LICENSE)
