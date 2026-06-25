# 08 — Development Roadmap

Trạng thái roadmap được đối chiếu với tag, `CHANGELOG.md` và code hiện tại ngày 2026-06-20. Các phase 0–11 là lịch sử đã phát hành; phase 12 trở đi lấy yêu cầu từ [12-future-features.md](12-future-features.md).

Ký hiệu: ✅ hoàn thành · 🟡 hoàn thành một phần · ⏳ chưa bắt đầu.

## Releases đã phát hành

| Phase | Version   | Trạng thái | Commit chính | Kết quả                                                                         |
| ----- | --------- | ---------- | ------------ | ------------------------------------------------------------------------------- |
| 0     | `v0.0.1`  | ✅         | `c99c3ff`    | Scaffold TypeScript, build, lint, test, CI và docs.                             |
| 1     | `v0.0.2`  | ✅         | `cf12ad5`    | Activity Bar, Connections TreeView, command và status bar.                      |
| 2     | `v0.0.3`  | ✅         | `ba6df62`    | Connection profile, SecretStorage, form CRUD/test và log masking.               |
| 3     | `v0.0.4`  | ✅         | `00e81dc`    | SQLite adapter, schema explorer và table viewer phân trang.                     |
| 4     | `v0.0.5`  | ✅         | `2831424`    | Query editor, result grid, query history, error normalization và cancel cơ bản. |
| 5     | `v0.0.6`  | ✅         | `7f55614`    | PostgreSQL adapter, schema layer và Docker fixture.                             |
| 6     | `v0.0.7`  | ✅         | `f5da004`    | MySQL/MariaDB adapter và metadata/pagination theo dialect.                      |
| 7     | `v0.0.8`  | ✅         | `7dd80e0`    | SQL Server adapter và `trustServerCertificate`.                                 |
| 8     | `v0.0.9`  | ✅         | `75cc932`    | FK dependency graph, filter direction/depth, search và export JSON.             |
| 9     | `v0.0.10` | ✅         | `94ba604`    | View dependency, cycle detection, impact report và export SVG.                  |
| 10    | `v1.0.0`  | ✅         | `2aad00a`    | Stable release: docs, security notices, VSIX packaging.                         |
| 11    | `v1.1.0`  | ✅         | `fe77a18`    | Redis adapter cơ bản, Redis Docker fixture và test tokenizer/adapter.           |

> Commit `9266444` bổ sung `INSTALL.md` và [13-usage-guide.md](13-usage-guide.md) sau `v1.1.0`; đưa hai tài liệu này vào release kế tiếp khi phát hành.

## Phase 12 — Properties & Data foundation ✅

Mục tiêu version: `v1.2.0` — phát hành 2026-06-21.

- [x] Object panel có tabs Properties: DDL, columns, foreign keys, indexes, triggers, checks và Reload.
- [x] Data grid phân trang (chọn page size), reload; edit row theo PK bằng parameterized statement.
- [x] Insert/delete row; mọi giá trị bind qua placeholder của driver (không nội suy chuỗi).
- [x] Thêm/xóa column qua UI với preview DDL (dialect-aware ADD COLUMN / ADD).
- [x] Production guard: confirm modal cho mọi thao tác ghi/DDL + banner production.
- [ ] (Backlog → Phase 13) filter/sort cục bộ và editable SQL bar ở đầu tab Data.

Commit gợi ý:

```txt
feat(properties): add object metadata tabs and reload action
feat(data): add editable table grid with primary-key transactions
feat(schema): add safe column ddl operations
feat(security): confirm write operations on production connections
test(data): cover row mutation SQL for supported adapters
```

## Phase 13 — Data exchange & durable history ✅

Mục tiêu version: `v1.3.0` — phát hành 2026-06-21.

- [x] Import CSV: auto-map theo tên cột, ô rỗng → NULL, insert parameterized, báo cáo dòng lỗi (cap 10k).
- [x] Export CSV/JSON/SQL Insert theo trang hoặc toàn bộ bảng (cap 50k); export cả từ Query Result panel.
- [x] Nâng query history: search/filter/favorite, retention (`openDbNexus.history.maxItems`), xóa một mục/toàn bộ/theo connection.
- [x] Phân trang data grid với page-size selector (đã có từ v1.2.0).
- [ ] (Backlog) Import/export XLSX (cần dependency spreadsheet — hoãn để giữ bundle nhẹ).
- [ ] (Backlog) Audit history riêng cho DDL/import/export.

Commit gợi ý:

```txt
feat(import): add csv and xlsx mapping workflow
feat(export): add csv xlsx json and sql-insert exporters
feat(history): add searchable query history and retention settings
feat(audit): record sanitized data and ddl operations
```

## Phase 14 — Mock Data & generators ✅

Mục tiêu version: `v1.4.0` — phát hành 2026-06-21.

- [x] Generator tự động theo type với seed (deterministic) và tỉ lệ `NULL`.
- [x] Bỏ qua PK integer (auto-increment); tôn trọng nullable; insert parameterized (cap 5k) + production guard.
- [x] Generate TypeScript interface, C# entity và CRUD SQL.
- [ ] (Backlog) Mock data thủ công theo ô và insert theo dependency order FK/unique.

Commit gợi ý:

```txt
feat(mock-data): add type-aware data generators
feat(mock-data): preserve relational constraints during generation
feat(generator): add typescript csharp and crud templates
```

## Phase 15 — Database Manager & operational safety ✅ (một phần)

Mục tiêu version: `v1.5.0` — phát hành 2026-06-21.

- [x] Backup logical: dump DDL + dữ liệu (INSERT) ra file `.sql` với progress (không cần pg_dump/mysqldump).
- [x] Dashboard: object count (tables/views) và server version theo engine.
- [x] Policy `disableWriteOnProduction`, `disableExportOnProduction` (chặn cứng) + `maxRows`.
- [ ] (Backlog) Log viewer và process/session list; cancel/kill có kiểm tra quyền.
- [ ] (Backlog) Role/privilege editor.

Commit gợi ý:

```txt
feat(manager): add engine-aware backup workflow
feat(manager): add process list and safe session cancellation
feat(security): add production policies and privilege checks
```

## Phase 16 — Query, schema & graph quality ✅ (một phần)

Mục tiêu version: `v1.6.0` — phát hành 2026-06-21.

- [x] Global schema search (table/view/column theo tên).
- [x] Local filter/sort trên result grid (numeric-aware, click header).
- [x] Cảnh báo SQL nguy hiểm (DROP/TRUNCATE/DELETE|UPDATE thiếu WHERE), bỏ qua comment/string.
- [ ] (Backlog) Schema cache, row estimate/table size, virtual grid, JSON/blob viewer.
- [ ] (Backlog) Procedure/trigger dependency graph, PNG export, explain-plan visualizer, mini-map.

## Phase 17 — Platform coverage & release quality ✅ (một phần)

Mục tiêu version: `v1.7.0` — phát hành 2026-06-21.

- [x] Contract test chung cho mọi adapter (shape + đủ method) — bắt lỗi khi thêm adapter mới.
- [x] SSL/TLS option per-connection (Postgres/MySQL), toggle trong form.
- [ ] (Backlog) DuckDB, MongoDB, Oracle adapters — cần dependency native/nặng, mỗi adapter một release riêng (dùng agent `db-adapter-builder`).
- [ ] (Backlog) SSH tunnel, workspace profiles, cloud secret provider, Docker integration test CI, Marketplace publish.

## Phase 18 — Startup & connection UX ✅

Mục tiêu version: `v1.7.2` — patch release.

- [x] TreeView schema/table metadata load nền: mở nhánh cũ hiển thị `Loading…`, không block explorer khi database cũ chậm/offline.
- [x] Người dùng vẫn tạo/sửa connection mới được ngay sau khi extension activate.
- [x] Giữ cache node theo connection/schema/table và clear cache khi Refresh hoặc profile thay đổi.
- [x] Changelog ghi rõ thay đổi hành vi load.

Commit gợi ý:

```txt
fix(tree): load database explorer children in background
docs(roadmap): add phase 18 startup responsiveness scope
chore(release): bump version to 1.7.2
```

## Phase 19 — DuckDB adapter 🟡

Mục tiêu version: `v1.8.0`.

- [x] DuckDB: file-based adapter, real connection/test path, read-only safety option qua `readonly` tag.
- [x] Metadata: schemas, tables/views, columns, indexes và DDL fallback.
- [x] Query runner với pagination/maxRows và qmark placeholder contract.
- [x] Unit coverage cho adapter và contract placeholder.
- [ ] Usage docs chi tiết cho Parquet/CSV/JSON và fixture file local.

## Phase 20 — MongoDB adapter 🟡

Mục tiêu version: `v1.9.0`.

- [x] MongoDB connection profile qua URI hoặc host/port/database/SSL.
- [x] Explorer foundation: databases, collections, sample fields và indexes.
- [x] JSON query bridge: generated table SELECT/COUNT và JSON `{ collection, filter, projection, sort, limit }`.
- [x] Unit coverage cho non-SQL adapter shape.
- [ ] Dedicated document viewer, safe document writes, Docker fixture và docs usage.

## Phase 21 — Oracle adapter 🟡

Mục tiêu version: `v1.10.0`.

- [x] Oracle adapter basic mode: username/password + connect string hoặc host/port/XE default.
- [x] Metadata: schemas, tables/views, columns, indexes, foreign keys, checks, triggers, view dependencies và DDL.
- [x] Query runner với bind variables `:p1`, Oracle pagination contract và result metadata.
- [x] Unit coverage cho metadata/query paths.
- [ ] Dedicated connection form fields cho SID/service/TNS/wallet, procedures/functions, Docker/local fixture và troubleshooting docs.

## Phase 22 — Tunnel, proxy & local discovery 🟡

Mục tiêu version: `v1.11.0`.

- [x] Profile model cho SSH tunnel, Socks/HTTP proxy, Docker discovery và JDBC bridge.
- [x] Transport planner/validator: resolve endpoint, composite mode, warnings và unit coverage.
- [ ] Runtime SSH tunnel lifecycle: local port allocation, host key policy, reconnect, password/key auth.
- [ ] Driver proxy integration hoặc tunnel helper fallback.
- [ ] Docker discovery thật từ local container port mapping.
- [ ] JDBC bridge proof-of-concept cho engine hiếm/nặng mà Node driver không phù hợp.

## Phase 23 — Cloud/serverless SQL 🟡

Mục tiêu version: `v1.12.0`.

- [x] Cloudflare D1 và Turso HTTP-SQL adapter foundation cho SQLite-compatible metadata/query.
- [x] Azure SQL Server preset dựa trên SQL Server adapter hiện có.
- [x] CockroachDB/GaussDB/Kingbase compatibility qua PostgreSQL-compatible adapter trước.
- [x] Redshift compatibility qua PostgreSQL-compatible adapter để chuẩn bị warehouse/cloud SQL.
- [ ] Dameng/BigQuery/Athena/Snowflake/Databricks auth/runtime research spike và cost guard riêng.

## Phase 24 — Analytics & lakehouse engines 🟡

Mục tiêu version: `v1.13.0`.

- [x] ClickHouse HTTP-SQL adapter foundation: databases, tables/views, columns, DDL và query runner.
- [x] Trino/Presto HTTP-SQL adapter foundation: schema/table/view/column metadata và query runner.
- [x] Apache Doris compatibility qua MySQL-compatible adapter; Redshift compatibility qua PostgreSQL-compatible adapter.
- [x] Warehouse query guard foundation cho query thiếu LIMIT/FETCH hoặc có full table scan pattern.
- [ ] Partitions/materialized views, Hive/TDengine runtime path, cost estimate thật và UI banner.

## Phase 25 — Non-SQL connectors ⏳

Mục tiêu version: `v1.14.0`.

- [ ] S3 browser + preview CSV/JSON/Parquet, mở query qua DuckDB khi có thể.
- [ ] Kafka/RabbitMQ explorer: topics/queues, preview/publish test message, schema registry nếu có.
- [ ] Elasticsearch/Loki/Cassandra/Neo4j: UI riêng theo document/graph/log thay vì ép vào SQL grid.
- [ ] FTP/WebDAV chỉ dùng cho import/export hoặc file browser phụ trợ.

## Phase 26 — Major version preparation

Mục tiêu version: `v2.0.0` khi có breaking change ở adapter contract, storage format hoặc UI workflow.

Đánh giá tại 2026-06-23: các thay đổi từ `v1.2.0`→`v1.7.2` vẫn **tương thích ngược** (thêm field optional `ssl`/`favorite`, thêm method adapter, thêm command/webview, thêm cache/load nền — không phá storage format hay contract cũ). Vì vậy **chưa tạo `v2.0.0`**; tiếp tục tăng MINOR `v1.x.0` cho tới khi có breaking change thực sự (đổi storage format profile, đổi chữ ký `DatabaseAdapter` theo cách phá vỡ, hoặc thay đổi workflow UI lớn). Khi đó mới mở milestone `v2.0.0` kèm migration path.

## Quy tắc phát hành

- Một phase chỉ được đánh ✅ khi code, test phù hợp rủi ro, docs và `CHANGELOG.md` đã cập nhật.
- Tạo một commit hoặc một nhóm commit nhỏ theo Conventional Commits; không dùng message chung chung như `update` hoặc `done`.
- Trước release: chạy `npm run check`, package VSIX, smoke test trong Extension Development Host, tạo tag và GitHub Release.
- Không gắn version/tag cho thay đổi chỉ mới nằm trong docs hoặc backlog.
