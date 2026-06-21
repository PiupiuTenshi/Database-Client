# 12 — Future Features

Danh sách tính năng sau `v1.1.0` (2026-06-20). Đánh dấu trạng thái: ✅ đã phát hành · 🟡 đã có một phần/nền tảng · 🔥 cao · ⭐ vừa · 💡 ý tưởng.

Các mục `✅` là phần đã có trong bản phát hành; các mục còn lại là backlog để lập kế hoạch version/commit tiếp theo, không phải cam kết đã hoàn thành.

## Đã phát hành `v1.2.0`–`v1.7.0` (2026-06-21)

- ✅ **Object panel có tabs** (Data sửa được · Columns · Constraints · Triggers · DDL) + UI kit dùng chung — `v1.2.0`.
- ✅ **Edit row theo PK** (insert/update/delete parameterized), **column add/drop** có preview DDL, **production guard** — `v1.2.0`.
- ✅ **Introspection trigger + check constraint** (SQLite/Postgres/MySQL/MSSQL) — `v1.2.0`.
- ✅ **Export** CSV/JSON/SQL Insert (trang hoặc toàn bộ) + export từ Query Result; **import CSV** auto-map — `v1.3.0`.
- ✅ **Query history nâng cao**: favorite, search, retention, xóa theo connection — `v1.3.0`.
- ✅ **Mock data generator** (seeded, type-aware) + **code generators** TS/C#/CRUD — `v1.4.0`.
- ✅ **Security policies** (chặn cứng write/export trên production), **logical SQL backup**, **connection dashboard** — `v1.5.0`.
- ✅ **Cảnh báo SQL nguy hiểm**, **global schema search**, **filter/sort trên result grid** — `v1.6.0`.
- ✅ **Adapter contract test** + **SSL/TLS option per-connection** (Postgres/MySQL) — `v1.7.0`.

Backlog còn lại (mỗi mục là một release tương lai): MongoDB/DuckDB/Oracle adapters, SSH tunnel, XLSX import/export, virtual grid, explain-plan, PNG graph export, procedure/trigger dependency graph, process/privilege manager, Marketplace publish. Xem trạng thái chi tiết bên dưới.

## 1. Database engines mới

- ✅ **Redis** adapter cơ bản: kết nối/PING, duyệt key bằng SCAN và chạy lệnh Redis trong Query Editor — `v1.1.0`, commit `fe77a18`.
- 🔥 **MongoDB** adapter (collections, documents, indexes; query bằng JSON filter).
- ⭐ **DuckDB** adapter (query Parquet/CSV/JSON, analytics local).
- ⭐ **Oracle** adapter.
- 💡 ClickHouse, Snowflake, Elasticsearch, Kafka explorer.

## 2. Redis nâng cao

- 🟡 Nền tảng adapter và command console đã có ở `v1.1.0`; các thao tác bên dưới chưa có UI chuyên biệt.
- 🔥 Key viewer theo type (string/hash/list/set/zset/stream) với UI riêng.
- ⭐ Phân nhóm key theo prefix (`user:*`) thành cây.
- ⭐ TTL, memory usage, rename/delete key.
- 💡 Pub/Sub monitor, SLOWLOG, INFO dashboard.

## 3. Schema explorer

- ✅ Metadata **columns, indexes, foreign keys** và DDL của table/view đã có cho SQLite, PostgreSQL, MySQL/MariaDB và SQL Server — `v1.0.0`.
- 🔥 Introspection **procedure / function / trigger** (đang thiếu) cho mọi engine hỗ trợ.
- ⭐ Lazy load + cache schema (`SchemaCacheStore`, TTL theo `openDbNexus.schemaCacheTtlSeconds`).
- ⭐ Tìm kiếm schema toàn cục (table/column theo tên).
- 💡 Hiển thị comment, row estimate, kích thước bảng.

## 4. Query runner & result grid

- ✅ Chạy selected/current/all statement tuần tự, result grid, query history và hủy theo `AbortSignal` cơ bản đã có — `v1.0.0`.
- 🔥 Virtual scroll cho result lớn; export CSV/JSON/SQL Insert.
- 🔥 Cảnh báo query nguy hiểm (DROP/TRUNCATE/DELETE-UPDATE không WHERE) — docs/06 §10.
- ⭐ Tách nhiều statement & chạy tuần tự với report từng câu.
- ⭐ Filter/sort cục bộ trên grid, copy cell/row as JSON.
- ⭐ Cancel query thật cho adapter async (Postgres/MySQL/MSSQL).
- 💡 Explain plan visualizer; query bookmark/favorite; pin tab.

## 5. Properties (cấu trúc đối tượng)

- 🟡 Adapter đã có nền tảng đọc DDL, column, index và foreign key; tab Properties để thao tác trực tiếp vẫn chưa có.
- 🔥 Tab **SQL/DDL**: hiển thị và copy câu lệnh tạo đối tượng theo đúng hệ quản trị cơ sở dữ liệu (CREATE TABLE/VIEW/PROCEDURE...).
- 🔥 Tab **Columns**: xem, thêm, sửa, xóa cột; hiển thị kiểu dữ liệu, nullable, default, identity/auto-increment và comment.
- 🔥 Tab **Foreign keys**: xem và quản lý khóa ngoại, quan hệ tham chiếu, quy tắc `ON UPDATE` / `ON DELETE`.
- ⭐ Tab **Indexes**: tạo/sửa/xóa index, unique index và xem các cột, thứ tự index.
- ⭐ Tab **Triggers**: xem SQL, tạo, bật/tắt hoặc xóa trigger khi engine hỗ trợ.
- ⭐ Tab **Checks**: quản lý `CHECK` constraint và nội dung điều kiện kiểm tra.
- ⭐ Nút **Reload** để nạp lại metadata/schema của đối tượng mà không cần đóng connection.

## 6. Data (xem và chỉnh sửa dữ liệu)

- ✅ Table Data viewer phân trang server-side (100 dòng/trang) đã có — `v1.0.0`, commit `00e81dc`.
- 🔥 Edit cell/row có transaction (yêu cầu PK) — docs/06 §14; hỗ trợ thêm và xóa row với xác nhận trước khi ghi.
- 🔥 Thêm/xóa column từ giao diện, có preview SQL và cảnh báo khi thao tác có thể làm mất dữ liệu.
- 🔥 Data grid phân trang/server-side, chọn số dòng mỗi trang, chuyển trang và hiển thị tổng số bản ghi khi engine hỗ trợ.
- 🔥 Hiển thị câu SQL đang tạo ở đầu tab Data; nút **Execute** để chạy lại sau khi người dùng chỉnh sửa câu truy vấn.
- ⭐ Filter builder, sort theo một/nhiều cột, tìm kiếm trong bảng và reload dữ liệu.
- ⭐ Import dữ liệu từ **CSV/XLSX (Excel)** với mapping cột, preview, kiểm tra kiểu dữ liệu và báo cáo dòng lỗi.
- ⭐ Export dữ liệu đang xem hoặc kết quả query ra **CSV/XLSX**, JSON và SQL Insert.
- ⭐ Chỉnh quyền/role cho database, schema hoặc table (ví dụ quyền master/system khi engine cho phép), có cảnh báo production và chặn thao tác khi không đủ quyền.
- 💡 Inline JSON/blob viewer, copy cell/row as JSON và lịch sử undo trong phiên chỉnh sửa.

## 7. Mock data

- 🔥 Tạo dữ liệu mẫu thủ công theo từng row/cột trong data grid.
- ⭐ Tạo tự động theo số lượng row và kiểu dữ liệu: number, decimal, boolean, date/time, UUID, email, tên, địa chỉ, JSON, enum và text.
- ⭐ Cho phép đặt seed, tỉ lệ null, range/format và quy tắc riêng theo cột; preview trước khi insert.
- ⭐ Tôn trọng PK, FK, unique/check constraint và tạo dữ liệu theo thứ tự dependency.

## 8. Manager & vận hành

- 🔥 Dump/backup database hoặc schema về máy, chọn định dạng phù hợp từng engine; hiển thị tiến trình và kết quả.
- ⭐ Dashboard connection/database: dung lượng, số bảng, số connection, slow query và chỉ số tài nguyên mà engine cung cấp.
- ⭐ Log viewer: error log, general/audit log khi tài khoản có quyền đọc; filter, tìm kiếm và export.
- ⭐ Process list/session monitor: xem query đang chạy, thời gian chạy, user/host; cancel/kill session có xác nhận và kiểm tra quyền.

## 9. History

- ✅ Query history cơ bản (lưu trạng thái, thời lượng, row count; mở lại query) đã có — `v1.0.0`, commit `2831424`.
- 🔥 Lịch sử câu query theo connection/database, thời gian chạy, thời lượng, trạng thái và số row ảnh hưởng.
- ⭐ Mở lại, copy hoặc chạy lại câu query; tìm kiếm, filter theo database/trạng thái và đánh dấu favorite.
- ⭐ Lưu lịch sử thao tác dữ liệu/DDL (insert, update, delete, import, export) với SQL đã thực thi và thông báo lỗi đã được che thông tin nhạy cảm.
- 💡 Cấu hình thời gian lưu, giới hạn dung lượng và nút xóa lịch sử theo connection hoặc toàn bộ.

## 10. Dependency graph nâng cao

- ✅ View dependency (PostgreSQL/SQL Server), cycle detection, Markdown impact report và export **SVG/JSON** đã có — `v1.0.0`, commit `94ba604`.
- 🔥 View/procedure/trigger dependency cho mọi engine (mở rộng phần đã có ở Postgres/MSSQL).
- 🔥 Export **PNG** (rasterize canvas) bên cạnh SVG/JSON đã có.
- ⭐ Layout đẹp hơn (dagre/force) — có thể bundle Cytoscape.js riêng cho webview.
- ⭐ Centrality (core table), impact analysis report chi tiết, highlight path.
- 💡 Mini-map, group theo schema/module, collapse node ít liên quan.

## 11. Productivity / generators (docs/08 backlog)

- ⭐ Generate TypeScript type / C# entity / CRUD query từ table.
- ⭐ Compare schema giữa 2 connection.
- 💡 Migration impact checker, ERD auto layout.

## 12. Security & ops

- ✅ SecretStorage, mask secret trong log, CSP webview và cảnh báo icon cho connection production đã có — `v1.0.0`.
- 🔥 Production guard: badge đỏ status bar, confirm write query, require gõ tên DB để DROP/TRUNCATE — docs/07 §11.
- ⭐ SSH tunnel; SSL options per-connection (trust cert toggle trong form).
- ⭐ Policy: `disableWriteOnProduction`, `disableExportOnProduction`, `maxRows`.
- 💡 Cloud secret provider; workspace-level connection profiles.

## 13. UX & release

- ✅ VSIX packaging và tài liệu cài đặt/sử dụng đã có ở `v1.0.0`/`v1.1.0`.
- ⭐ Demo GIF/screenshots, theme polish, accessibility audit.
- ⭐ Publish lên VS Code Marketplace (cần publisher token + icon PNG 128×128).
- 💡 Telemetry opt-in tôn trọng setting VS Code (không gửi SQL/schema/secret).

## 14. Testing

- ✅ Unit test adapter/core và integration test SQLite in-memory đã có; Docker fixture cho PostgreSQL, MySQL, SQL Server và Redis đã được thêm theo từng adapter.
- ⭐ Integration test chạy thật qua Docker (Postgres/MySQL/SQL Server/Redis) trong CI tùy chọn.
- ⭐ Contract test chung cho mọi adapter (đảm bảo cùng shape output).
