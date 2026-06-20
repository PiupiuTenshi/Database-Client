# Open DB Nexus

Open DB Nexus is a VS Code multi-database client extension project. The goal is to provide a schema explorer, SQL query runner, result grid, and dependency graph tooling for database objects.

This repository is currently at Phase 0: project setup.

## Current Features

- VS Code extension scaffold in TypeScript.
- Command palette command: `Open DB Nexus: Hello World`.
- esbuild bundling.
- TypeScript type checking.
- ESLint and Prettier setup.
- Vitest unit test setup.
- GitHub Actions CI workflow.
- Design documents under [`docs/`](docs/README.md).

## Development

Install dependencies:

```bash
npm install
```

Run the full local check:

```bash
npm run check
```

Start the extension in VS Code:

1. Open this folder in VS Code.
2. Press `F5`.
3. Run `Open DB Nexus: Hello World` from the command palette.

## Scripts

```txt
npm run compile      Type-check TypeScript.
npm run lint         Run ESLint.
npm test             Run Vitest tests.
npm run package      Build production extension bundle.
npm run format       Format files with Prettier.
```

## Documentation

The product and architecture docs live in [`docs/`](docs/README.md).

## Security

Future connection secrets must be stored with VS Code `SecretStorage`. Secrets must not be written to plaintext settings, files, logs, webviews, or query history.

## License

MIT
