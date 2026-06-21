# Open DB Nexus

Open DB Nexus is an original VS Code extension concept for managing multiple databases and visualizing schema dependencies directly inside the editor.

> This project is not affiliated with, derived from, or intended to bypass licensing of any existing database client extension.

## Features

- Unlimited local connection profiles managed by the extension.
- Multi-database adapter architecture.
- Database explorer tree view.
- SQL query editor.
- Result grid.
- Table viewer.
- Foreign key dependency graph.
- Future support for view, procedure, function and trigger dependency analysis.

## Planned DBMS Support

- SQLite
- PostgreSQL
- MySQL / MariaDB
- SQL Server
- DuckDB
- MongoDB
- Redis
- Oracle

## Core Idea

Instead of clicking table by table to understand schema relationships, Open DB Nexus can build a graph from database metadata:

```txt
order_items -> orders -> users
order_items -> products
payments -> orders
```

This makes schema analysis, impact checking and database learning faster.

## Development Status

Current phase:

```txt
Documentation and architecture design
```

## Roadmap

- v0.1.0: SQLite + TreeView + Query Runner
- v0.2.0: PostgreSQL + MySQL
- v0.3.0: SQL Server + Table Viewer
- v0.4.0: Foreign Key Dependency Graph
- v0.5.0: View/Procedure/Trigger Dependency
- v1.0.0: Stable release

## Documentation

See [`docs/README.md`](docs/README.md).

## Security

Passwords and tokens must be stored using VS Code SecretStorage. The extension must not store secrets in plaintext settings or logs.

## License

Choose a license before release, for example MIT or Apache-2.0.
