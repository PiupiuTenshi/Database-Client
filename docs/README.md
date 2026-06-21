# VS Code Database Client Extension — Open Design Docs

> Mục tiêu: thiết kế một extension VS Code quản trị database theo hướng **mở rộng, không giới hạn số connection do chính ta quản lý**, hỗ trợ nhiều hệ quản trị cơ sở dữ liệu, và có chức năng **xem phụ thuộc giữa bảng / view / procedure / foreign key bằng graph** thay vì phải bấm từng bảng.

## 0. Lưu ý pháp lý và định hướng đúng

Tài liệu này **không hướng dẫn crack, bypass license, gỡ giới hạn trả phí, sao chép source code hoặc asset của extension khác**.

Hướng đúng là:

- Xây một extension mới từ đầu.
- Có thể lấy cảm hứng về UX từ các database client phổ biến.
- Không copy icon, UI asset, code, tên thương mại, telemetry endpoint, cấu trúc license, hoặc nội dung proprietary.
- Nếu dùng package open-source thì phải kiểm tra license.
- “Không giới hạn connect” nghĩa là extension của mình không tự đặt giới hạn số connection profile được lưu hoặc mở, không phải phá giới hạn của extension khác.

## 1. Tên dự án gợi ý

Tên tạm:

```txt
Open DB Nexus
```

Các tên khác:

```txt
Nexus SQL Client
Schema Atlas
DB Dependency Explorer
DarkDB Studio
VS DB Atlas
```

## 2. Vấn đề cần giải quyết

Nhiều database client trong VS Code cho phép kết nối database, mở table, chạy SQL, export/import. Tuy nhiên khi database lớn, việc quản trị sẽ khó ở các điểm:

- Phải bấm từng bảng để xem cột.
- Phải tự lần foreign key để biết bảng nào phụ thuộc bảng nào.
- Không thấy graph quan hệ tổng thể.
- Chưa gom tốt MySQL, PostgreSQL, SQL Server, SQLite, MongoDB, Redis, Oracle, MariaDB, DuckDB.
- Một số extension có giới hạn tính năng hoặc giới hạn số connection.
- Connection profile, mật khẩu, query history cần quản lý an toàn.
- Cần hỗ trợ project sinh viên, đồ án, backend, database distributed, microservice.

## 3. Mục tiêu sản phẩm

Extension cần có:

| Nhóm             | Chức năng                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Connection       | Lưu nhiều connection profile, folder/group, tag, search                                     |
| Multi DBMS       | MySQL, MariaDB, PostgreSQL, SQL Server, SQLite trước; sau đó MongoDB, Redis, Oracle, DuckDB |
| Query Editor     | Mở SQL editor, chạy selected/current/all query, hiển thị result grid                        |
| Schema Explorer  | Database → schema → table/view/procedure/function/index/trigger                             |
| Dependency Graph | Xem phụ thuộc FK, view dependency, procedure reference, trigger relation                    |
| Table View       | Xem data, filter, sort, pagination, edit row có transaction                                 |
| ERD Light        | Tạo ERD nhanh từ schema và FK                                                               |
| Search           | Search table, column, procedure, view, text trong DDL                                       |
| Import/Export    | CSV, JSON, SQL insert, dump command wrapper                                                 |
| History          | Query history, pinned query, favorite query                                                 |
| Security         | SecretStorage cho password/token, không log secret                                          |
| Dev UX           | Command palette, context menu, sidebar, status bar                                          |

## 4. Cấu trúc bộ tài liệu

```txt
docs/
├── README.md
├── 01-product-requirements.md
├── 02-system-architecture.md
├── 03-vscode-extension-design.md
├── 04-database-adapter-layer.md
├── 05-dependency-graph-design.md
├── 06-query-runner-and-result-grid.md
├── 07-security-license-and-ethics.md
├── 08-development-roadmap.md
├── 09-testing-strategy.md
├── 10-repo-structure-and-tasks.md
├── 11-phases-github-versioning.md
├── 12-future-features.md
└── 13-usage-guide.md
```

## 5. Tech stack đề xuất

```txt
Runtime: Node.js
Language: TypeScript
VS Code API: vscode extension API
UI: VS Code TreeView + Webview
Graph UI: React + Cytoscape.js hoặc React Flow
State: Zustand hoặc plain service class
DB drivers:
  - MySQL/MariaDB: mysql2
  - PostgreSQL: pg
  - SQL Server: tedious hoặc mssql
  - SQLite: better-sqlite3 hoặc sqlite3
  - DuckDB: duckdb
  - MongoDB: mongodb
  - Redis: ioredis
Packaging: vsce
Test: vitest + @vscode/test-electron
Lint/Format: ESLint + Prettier
```

## 6. MVP ngắn gọn

MVP nên làm theo thứ tự:

1. Tạo extension TypeScript cơ bản.
2. Tạo Activity Bar icon + Sidebar TreeView.
3. Thêm connection profile cho SQLite và PostgreSQL.
4. Lưu password bằng SecretStorage.
5. Hiển thị schema tree.
6. Mở SQL editor và chạy query.
7. Hiển thị result grid bằng webview.
8. Extract foreign key metadata.
9. Vẽ dependency graph bằng webview.
10. Thêm search table/column.

## 7. Nguyên tắc thiết kế

- Adapter pattern: mỗi DBMS là một adapter riêng, UI không biết chi tiết driver.
- Không hardcode SQL metadata chung cho tất cả DBMS.
- Query chạy bất đồng bộ, có cancel token.
- Result grid phân trang, không load vô hạn một lần.
- Cache schema có TTL và nút refresh.
- Không lưu password plaintext.
- Không log connection string đầy đủ.
- Graph phải có filter, direction, depth, search node.
- Extension phải dùng theme color của VS Code, không phá giao diện editor.

## 8. Thành quả kỳ vọng

Sau khi hoàn thành, extension có thể:

- Quản trị nhiều connection.
- Chạy SQL trong VS Code.
- Mở table và xem data.
- Xem phụ thuộc giữa các bảng trực quan.
- Dùng cho đồ án database, backend, distributed database, microservice.
- Phát triển thành project portfolio mạnh cho hướng backend/tooling/dev productivity.

## 9. GitHub workflow bổ sung

Xem thêm:

```txt
11-phases-github-versioning.md
```

File này mô tả chi tiết các phase thực hiện, branch strategy, commit convention, version tag và GitHub Release cho từng mốc phát triển.

`11-phases-github-versioning.md` cũng có lệnh cài GitHub CLI (`gh`), đăng nhập, commit, push, tag, tạo GitHub Release và upload file `.vsix`.
