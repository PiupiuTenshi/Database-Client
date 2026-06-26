# 13 — Usage Guide (Hướng dẫn sử dụng)

Hướng dẫn dùng Open DB Nexus sau khi đã cài (xem [INSTALL.md](../INSTALL.md)).

## 1. Mở extension

Bấm icon **Open DB Nexus** (🛢️) trên Activity Bar. View **Connections** hiện ở sidebar.

### Kiểm tra cập nhật

- Bấm nút **Check for Updates** (icon cloud download) trên title của view **Connections**.
- Hoặc mở Command Palette (`Ctrl+Shift+P`) → **Open DB Nexus: Check for Updates**.
- Khi có bản mới trên GitHub Releases, chọn **Install Update** để extension tải `.vsix`, chạy luồng cài đặt của VS Code và hỏi reload.
- Tự kiểm tra khi khởi động được điều khiển bằng `openDbNexus.updates.autoCheckOnStartup` và `openDbNexus.updates.checkIntervalHours`.

## 2. Tạo connection

1. Bấm **＋ Add Connection** (góc trên view) → form mở ra.
2. Chọn **Database Type**, điền field theo bảng dưới, đặt **Environment** (local/dev/staging/production) và **Tags** nếu muốn.
3. Bấm **Test Connection** để kiểm tra, rồi **Save**.

Password chỉ lưu ở VS Code **SecretStorage** (không vào file/log).

### Field theo từng loại DB

| Database      | Field bắt buộc   | Ghi chú                                     |
| ------------- | ---------------- | ------------------------------------------- |
| SQLite        | File Path        | Đường dẫn file `.sqlite` hoặc `:memory:`    |
| PostgreSQL    | Host (Port 5432) | Database mặc định `postgres`                |
| MySQL/MariaDB | Host (Port 3306) | Nên điền Database (schema)                  |
| SQL Server    | Host (Port 1433) | `trustServerCertificate` bật sẵn cho Docker |
| Redis         | Host (Port 6379) | Database = số DB index (0–15)               |

> Sửa/xóa: chuột phải connection → **Edit Connection** / **Delete Connection** (có xác nhận).
> **Test Connection** cũng có ở chuột phải (kết nối thật).

## 3. Duyệt schema

Mở rộng một connection:

```txt
Connection
└── (Schema)            ← Postgres/MySQL/SQL Server; SQLite không có lớp này
    ├── Tables
    │   └── <table>
    │       ├── Columns        (PK / NOT NULL hiển thị)
    │       ├── Indexes
    │       └── Foreign Keys   (cột nguồn → bảng đích)
    └── Views
```

- **Refresh** (góc view) nạp lại schema và đóng các session cũ.
- Connection `production` hiện icon ⚠️ để cảnh báo.

### Khi tree cứ hiện `Loading...`

Từ bản mới, tree sẽ tự dừng sau `openDbNexus.metadata.loadTimeoutSeconds` giây (mặc định 15s) và hiện lỗi timeout để bạn biết DB/metadata đang chậm thay vì treo mãi.

Các nguyên nhân thường gặp:

- Host/port sai, VPN/proxy chưa kết nối hoặc DB container chưa expose port.
- DB ở xa hoặc cold start, nhất là cloud/serverless.
- User DB không có quyền đọc catalog/schema nên metadata query chờ lâu hoặc lỗi.
- Oracle/MongoDB/warehouse có nhiều schema/database, metadata đầu tiên cần nhiều thời gian.

Cách xử lý nhanh:

- Bấm **Refresh** trên view **Connections** để thử lại.
- Dùng **Test Connection** trước khi mở rộng schema.
- Với DB rất lớn/ở xa, tăng `openDbNexus.metadata.loadTimeoutSeconds` lên 30-60.
- Với cloud/warehouse, ưu tiên điền đúng database/schema mặc định để giảm lượng metadata cần quét.

## 4. Xem/sửa dữ liệu và properties của bảng

Chuột phải một **table** → **Open Table Data**. Webview mở panel tab:

- **Data**: xem dữ liệu, chọn page size, Prev/Next, Reload.
- **Columns**: xem cột, thêm/xóa column với preview DDL trước khi chạy.
- **Constraints**: indexes, foreign keys, check constraints.
- **Triggers**: danh sách trigger nếu engine hỗ trợ trả metadata.
- **DDL**: xem/copy DDL của object.

Trong tab **Data**:

- Double-click một cell để sửa. Bảng cần có primary key thì mới edit/delete được.
- **＋ Add row** để thêm dòng mới.
- Nút thùng rác ở đầu dòng để delete.
- **Export** ra CSV/JSON/SQL Insert theo page hiện tại hoặc toàn bộ bảng.
- **Import CSV** để import CSV, header tự map theo tên cột; ô rỗng thành `NULL`.

Connection `production` sẽ hiện cảnh báo; thao tác ghi/DDL cần xác nhận. Nếu setting
`openDbNexus.security.disableWriteOnProduction` hoặc
`openDbNexus.security.disableExportOnProduction` đang bật, extension sẽ chặn hẳn thao tác tương ứng.

## 5. Mock data và generate code

Chuột phải một **table**:

- **Generate Mock Data**: nhập số dòng cần tạo; dữ liệu sinh theo type, có seed ổn định, bỏ qua integer PK auto-increment. Cap 5k dòng/lần.
- **Generate Code**: chọn TypeScript interface, C# entity class hoặc CRUD SQL; kết quả mở trong editor mới.

## 6. Quản lý connection

Chuột phải một **connection**:

- **Open Dashboard**: xem loại DB, table/view count và server version.
- **Backup**: xuất logical SQL dump gồm DDL và dữ liệu INSERT ra file `.sql`.
- **Search Schema**: tìm table/view/column theo tên, rồi mở table tương ứng.

## 7. Chạy SQL (Query Editor)

1. Chuột phải connection → **Open Query Editor** (tạo file SQL gắn với connection đó). Status bar dưới hiện connection đang bind — bấm để đổi.
2. Gõ SQL, rồi:
   - **Ctrl+Enter** — chạy phần đang bôi đen, hoặc statement tại con trỏ.
   - **Ctrl+Shift+Enter** — chạy toàn bộ file.
3. Nếu query có `DROP`, `TRUNCATE`, hoặc `DELETE`/`UPDATE` không có `WHERE`, extension sẽ hỏi xác nhận trước khi chạy.
4. Kết quả hiện ở **Query Result** grid; có filter live, sort bằng cách click header và **Export** CSV/JSON/SQL Insert.
5. **Show Query History** (Command Palette) để mở lại query cũ, tìm kiếm, favorite hoặc xóa history.

## 8. Dependency Graph

Chuột phải một **table** → **Open Dependency Graph**:

- Chọn **Direction** (inbound / outbound / both) và **Depth** (1/2/3/all).
- **Search** để highlight node; **double-click** node để mở Table Data.
- **Export JSON** / **Export SVG** để lưu graph.
- **Report** (hoặc menu **Open Dependency Report**) sinh báo cáo Markdown: bảng phụ thuộc ai, ai phụ thuộc nó, impact lan truyền, và **chu trình** (nếu có).
- Cạnh nét đứt = **view dependency** (Postgres/SQL Server).

## 9. Dùng Redis

Redis là key-value, không phải SQL:

- Cây liệt kê **keys** dưới mục "Tables".
- Dùng **Open Query Editor** rồi gõ lệnh Redis, chạy bằng **Ctrl+Enter**:
  ```txt
  SET greeting "hello"
  GET greeting
  KEYS *
  ```
- Các tính năng SQL (table viewer phân trang, dependency graph) **không áp dụng** cho Redis.

## 10. Trạng thái adapter nâng cao

Các adapter sau đã có nền tảng kết nối/metadata/query nhưng vẫn còn thiếu một số UI chuyên biệt hoặc preset auth nâng cao:

- DuckDB, MongoDB, Oracle.
- Cloudflare D1, Turso, Azure SQL, CockroachDB, GaussDB, Kingbase, Redshift.
- ClickHouse, Trino, Presto, Apache Doris.
- SSH tunnel/proxy/Docker/JDBC hiện đã có model và planner; runtime tunnel/proxy thật vẫn nằm trong backlog.

Các mục như XLSX import/export, process/session monitor, role/privilege editor, explain-plan visualizer, PNG graph export và JSON/blob viewer nâng cao vẫn xem ở [12-future-features.md](12-future-features.md).

## 11. Mẹo

- DB test local bằng Docker: xem [test/docker/README.md](../test/docker/README.md).
- Số dòng tối đa mặc định khi chạy query: setting `openDbNexus.query.maxRows` (mặc định 1000).
- Tính năng dự kiến thêm: xem [12-future-features.md](12-future-features.md).
