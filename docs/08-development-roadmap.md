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

## Phase 19 — Adapter wave 1 ⏳

Mục tiêu version: `v1.8.0`.

- [ ] DuckDB: file-based adapter, query Parquet/CSV/JSON, read-only safety option.
- [ ] MongoDB: collections/documents/indexes, JSON filter runner, document viewer.
- [ ] Oracle: connection form fields, schemas/tables/views/procedures, query runner.
- [ ] Mỗi adapter phải có contract test, docs usage và Docker/local fixture nếu khả thi.

## Phase 20 — Tunnel, proxy & local discovery ⏳

Mục tiêu version: `v1.9.0`.

- [ ] SSH tunnel per-connection: local port, host key policy, reconnect, password/key auth.
- [ ] Socks Proxy và HTTP Proxy config cho driver hỗ trợ hoặc tunnel helper fallback.
- [ ] Docker discovery: phát hiện container database local và tạo connection từ port mapping.
- [ ] JDBC bridge proof-of-concept cho engine hiếm/nặng mà Node driver không phù hợp.

## Phase 21 — Cloud/serverless SQL ⏳

Mục tiêu version: `v1.10.0`.

- [ ] Cloudflare D1 và Turso (SQLite-compatible remote/local workflow).
- [ ] Azure SQL Server preset dựa trên SQL Server adapter hiện có.
- [ ] CockroachDB/GaussDB/Kingbase/Dameng compatibility qua PostgreSQL-compatible adapter trước.
- [ ] BigQuery/Athena/Snowflake/Databricks research spike: driver, auth, pagination, cost guard.

## Phase 22 — Analytics & lakehouse engines ⏳

Mục tiêu version: `v1.11.0`.

- [ ] ClickHouse adapter: database/table/view metadata, partitions, query runner.
- [ ] Trino/Presto adapter: catalog/schema explorer và result pagination.
- [ ] Apache Doris, Hive, Redshift, TDengine đánh giá theo mức độ tương thích JDBC/HTTP.
- [ ] Cost/safety banner cho warehouse query lớn.

## Phase 23 — Non-SQL connectors ⏳

Mục tiêu version: `v1.12.0`.

- [ ] S3 browser + preview CSV/JSON/Parquet, mở query qua DuckDB khi có thể.
- [ ] Kafka/RabbitMQ explorer: topics/queues, preview/publish test message, schema registry nếu có.
- [ ] Elasticsearch/Loki/Cassandra/Neo4j: UI riêng theo document/graph/log thay vì ép vào SQL grid.
- [ ] FTP/WebDAV chỉ dùng cho import/export hoặc file browser phụ trợ.

## Phase 24 — Major version preparation

Mục tiêu version: `v2.0.0` khi có breaking change ở adapter contract, storage format hoặc UI workflow.

Đánh giá tại 2026-06-23: các thay đổi từ `v1.2.0`→`v1.7.2` vẫn **tương thích ngược** (thêm field optional `ssl`/`favorite`, thêm method adapter, thêm command/webview, thêm cache/load nền — không phá storage format hay contract cũ). Vì vậy **chưa tạo `v2.0.0`**; tiếp tục tăng MINOR `v1.x.0` cho tới khi có breaking change thực sự (đổi storage format profile, đổi chữ ký `DatabaseAdapter` theo cách phá vỡ, hoặc thay đổi workflow UI lớn). Khi đó mới mở milestone `v2.0.0` kèm migration path.

## Quy tắc phát hành

- Một phase chỉ được đánh ✅ khi code, test phù hợp rủi ro, docs và `CHANGELOG.md` đã cập nhật.
- Tạo một commit hoặc một nhóm commit nhỏ theo Conventional Commits; không dùng message chung chung như `update` hoặc `done`.
- Trước release: chạy `npm run check`, package VSIX, smoke test trong Extension Development Host, tạo tag và GitHub Release.
- Không gắn version/tag cho thay đổi chỉ mới nằm trong docs hoặc backlog.
