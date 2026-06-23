# 10 — Repo Structure and Task Breakdown

## 1. Repo structure đề xuất

```txt
open-db-nexus/
├── .github/
│   └── workflows/
│       └── ci.yml
├── docs/
│   ├── README.md
│   ├── 01-product-requirements.md
│   ├── 02-system-architecture.md
│   ├── 03-vscode-extension-design.md
│   ├── 04-database-adapter-layer.md
│   ├── 05-dependency-graph-design.md
│   ├── 06-query-runner-and-result-grid.md
│   ├── 07-security-license-and-ethics.md
│   ├── 08-development-roadmap.md
│   ├── 09-testing-strategy.md
│   └── 10-repo-structure-and-tasks.md
├── resources/
│   └── db-nexus.svg
├── src/
│   ├── extension.ts
│   ├── commands/
│   │   ├── registerCommands.ts
│   │   ├── connectionCommands.ts
│   │   ├── queryCommands.ts
│   │   └── graphCommands.ts
│   ├── core/
│   │   ├── types.ts
│   │   ├── errors.ts
│   │   └── constants.ts
│   ├── services/
│   │   ├── ConnectionService.ts
│   │   ├── SchemaService.ts
│   │   ├── QueryService.ts
│   │   ├── DependencyGraphService.ts
│   │   └── LogService.ts
│   ├── storage/
│   │   ├── ProfileStore.ts
│   │   ├── SecretStore.ts
│   │   ├── QueryHistoryStore.ts
│   │   └── SchemaCacheStore.ts
│   ├── adapters/
│   │   ├── DatabaseAdapter.ts
│   │   ├── AdapterRegistry.ts
│   │   ├── sqlite/
│   │   ├── postgresql/
│   │   ├── mysql/
│   │   └── sqlserver/
│   ├── views/
│   │   └── databaseExplorer/
│   │       ├── DatabaseTreeProvider.ts
│   │       ├── nodes/
│   │       └── icons.ts
│   ├── webviews/
│   │   ├── WebviewBase.ts
│   │   ├── connectionForm/
│   │   ├── queryResult/
│   │   ├── tableViewer/
│   │   └── dependencyGraph/
│   └── utils/
│       ├── maskSecret.ts
│       ├── sqlSafety.ts
│       ├── objectId.ts
│       └── debounce.ts
├── test/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── package.json
├── tsconfig.json
├── esbuild.js
├── README.md
├── LICENSE
├── SECURITY.md
└── THIRD_PARTY_NOTICES.md
```

## 2. Branch strategy

```txt
main
develop
feature/connection-manager
feature/sqlite-adapter
feature/query-runner
feature/dependency-graph
fix/*
docs/*
```

## 3. Commit convention

Dùng Conventional Commits:

```txt
feat: add sqlite adapter
fix: mask password in connection log
docs: add dependency graph design
test: add postgres foreign key metadata test
refactor: split schema service from connection service
```

## 4. Issue template

```md
## Summary

## Expected Behavior

## Actual Behavior

## Steps to Reproduce

## Environment

- OS:
- VS Code:
- Extension:
- DBMS:

## Logs
```

## 5. Task breakdown theo role

### Backend/Extension Core

- Adapter interface.
- Connection service.
- Query service.
- Schema service.
- Storage.
- Secret management.
- Error normalization.

### Frontend/Webview UI

- Connection form.
- Result grid.
- Dependency graph.
- Table viewer.
- Theme-aware UI.
- Empty/loading/error state.

### QA/Docs

- Test plan.
- Docker test database.
- Manual checklist.
- README.
- Demo GIF.
- Security checklist.

## 6. Milestone task list (đã đồng bộ v1.1.0)

### Đã phát hành

- [x] `v0.0.1`–`v0.0.5`: scaffold, VS Code shell, connection manager, SQLite, Query Editor/result grid/history.
- [x] `v0.0.6`–`v0.0.8`: PostgreSQL, MySQL/MariaDB và SQL Server adapters.
- [x] `v0.0.9`–`v0.0.10`: FK graph, view dependency, cycle detection, Markdown impact report, JSON/SVG export.
- [x] `v1.0.0`: security/docs/notices và VSIX packaging.
- [x] `v1.1.0`: Redis adapter cơ bản, Docker fixture và test.

### Kế tiếp theo roadmap

- [ ] `v1.2.0`: Properties tabs; data grid edit/insert/delete/column DDL và production guard.
- [ ] `v1.3.0`: import/export CSV/XLSX, data audit và history có search/retention.
- [ ] `v1.4.0`: mock data thủ công/tự động và code generators.
- [ ] `v1.5.0`: manager (backup, dashboard, logs, process list), role/privilege editor.
- [ ] `v1.6.0+`: query/schema/graph nâng cao; adapter mới; test/UX/release quality.

Chi tiết acceptance criteria, commit gợi ý và thứ tự phase xem [08-development-roadmap.md](08-development-roadmap.md); trạng thái từng feature xem [12-future-features.md](12-future-features.md).

## 7. Commands cần có

```txt
openDbNexus.addConnection
openDbNexus.editConnection
openDbNexus.deleteConnection
openDbNexus.testConnection
openDbNexus.refreshConnection
openDbNexus.openQuery
openDbNexus.runSelectedQuery
openDbNexus.runCurrentQuery
openDbNexus.runAllQueries
openDbNexus.cancelQuery
openDbNexus.openTable
openDbNexus.openDDL
openDbNexus.openDependencyGraph
openDbNexus.exportResultCsv
openDbNexus.exportResultJson
openDbNexus.copyObjectName
openDbNexus.generateSelect
openDbNexus.generateInsert
```

## 8. NPM scripts

```json
{
  "scripts": {
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "lint": "eslint src test",
    "test": "vitest",
    "test:integration": "vitest run test/integration",
    "package": "vsce package",
    "format": "prettier --write ."
  }
}
```

## 9. Local development flow

```bash
npm install
npm run compile
code .
```

Trong VS Code:

```txt
Press F5 → Extension Development Host
```

Test command:

```txt
Ctrl+Shift+P
Open DB Nexus: Add Connection
```

## 10. Definition of Done

Một task được xem là xong khi:

- Code chạy được.
- Có type rõ ràng.
- Có xử lý lỗi.
- Không log secret.
- Có test nếu là logic core.
- Có docs ngắn nếu là feature mới.
- Không phá adapter khác.
- Không làm extension activate quá sớm.
