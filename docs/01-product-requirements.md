# 01 — Product Requirements Document

## 1. Tóm tắt sản phẩm

**Open DB Nexus** là một extension VS Code giúp developer quản trị nhiều hệ quản trị cơ sở dữ liệu ngay trong editor. Extension tập trung vào ba điểm mạnh:

1. Không giới hạn số connection profile do người dùng lưu trong extension.
2. Hỗ trợ nhiều loại database bằng kiến trúc adapter.
3. Có Dependency Graph để xem quan hệ phụ thuộc giữa bảng, view, procedure, trigger thay vì phải click từng table.

## 2. Người dùng mục tiêu

### 2.1 Sinh viên công nghệ thông tin

Nhu cầu:

- Làm đồ án database.
- Kết nối MySQL, SQL Server, PostgreSQL, SQLite.
- Xem bảng, cột, khóa chính, khóa ngoại.
- Giải thích ERD và luồng phụ thuộc cho giảng viên.

### 2.2 Backend developer

Nhu cầu:

- Test query nhanh trong VS Code.
- Kiểm tra schema trong lúc code API.
- Tìm bảng liên quan khi sửa feature.
- Xem migration ảnh hưởng đến bảng nào.

### 2.3 Data / DevOps / QA

Nhu cầu:

- Kiểm tra dữ liệu test.
- Export/import dataset.
- So sánh schema giữa môi trường local/dev/staging.
- Kiểm tra dependency trước khi drop/alter table.

## 3. Problem Statement

Khi database có nhiều bảng, việc mở từng bảng để tìm foreign key rất mất thời gian. Developer thường cần biết:

- Bảng này được bảng nào tham chiếu?
- Nếu sửa cột này thì view/procedure nào bị ảnh hưởng?
- Nếu xóa bảng này thì dependency chain ra sao?
- Bảng nào là trung tâm của module?
- Quan hệ giữa order, order_item, product, user, payment là gì?

Extension cần trả lời trực quan bằng graph.

## 4. Scope

### 4.1 Trong scope

- Connection manager.
- Query editor.
- Result grid.
- Schema explorer.
- Dependency graph.
- Table data viewer.
- Search schema.
- Query history.
- Export CSV/JSON/SQL.
- Basic edit row với transaction.
- Multi-database adapter.

### 4.2 Ngoài scope ở giai đoạn đầu

- Full database design studio như DataGrip.
- Visual query builder kéo thả phức tạp.
- AI query generation.
- Team sharing connection qua cloud.
- Real-time collaboration.
- Auto migration generator production-grade.
- Full NoSQL visual designer.

## 5. User Stories

### Connection

```txt
Là developer, tôi muốn lưu nhiều connection để chuyển nhanh giữa local, Docker, cloud, staging.
```

Acceptance criteria:

- Tạo connection mới.
- Test connection trước khi lưu.
- Sửa/xóa connection.
- Group connection theo folder/tag.
- Search connection.
- Password không lưu plaintext.

### Schema Explorer

```txt
Là developer, tôi muốn nhìn toàn bộ database trong sidebar để mở table, view, procedure nhanh.
```

Acceptance criteria:

- Tree gồm connection → database → schema → object type → object.
- Có refresh schema.
- Có search table/column.
- Có context menu: Open Table, Open DDL, Open Dependency Graph, Copy Name.

### Query Editor

```txt
Là developer, tôi muốn chạy SQL ngay trong VS Code bằng phím tắt.
```

Acceptance criteria:

- Chạy selected query.
- Chạy query tại cursor.
- Chạy toàn bộ file.
- Hiển thị thời gian chạy.
- Hiển thị số row affected.
- Hiển thị lỗi rõ ràng.
- Có query history.

### Dependency Graph

```txt
Là developer, tôi muốn xem bảng nào liên quan đến bảng hiện tại bằng graph.
```

Acceptance criteria:

- Mở graph từ context menu của table.
- Hiển thị inbound dependency.
- Hiển thị outbound dependency.
- Có depth 1/2/3/all.
- Click node để mở table.
- Filter theo object type.
- Export PNG/SVG/JSON.

## 6. Functional Requirements

### FR-001: Connection Profile

Mỗi connection profile gồm:

```ts
type ConnectionProfile = {
  id: string;
  name: string;
  dbType: DbType;
  host?: string;
  port?: number;
  username?: string;
  database?: string;
  filePath?: string;
  ssl?: boolean;
  sshTunnel?: SshTunnelConfig;
  tags: string[];
  color?: string;
  createdAt: string;
  updatedAt: string;
};
```

Password lưu riêng trong `SecretStorage`.

### FR-002: Database Adapter

Mỗi DBMS cần implement interface chung:

```ts
interface DatabaseAdapter {
  connect(profile: ConnectionProfile): Promise<DbConnection>;
  testConnection(profile: ConnectionProfile): Promise<TestResult>;
  listDatabases(): Promise<DatabaseInfo[]>;
  listSchemas(database: string): Promise<SchemaInfo[]>;
  listTables(schema: string): Promise<TableInfo[]>;
  listColumns(table: ObjectRef): Promise<ColumnInfo[]>;
  listForeignKeys(table?: ObjectRef): Promise<ForeignKeyInfo[]>;
  listViews(schema: string): Promise<ViewInfo[]>;
  getObjectDDL(ref: ObjectRef): Promise<string>;
  executeQuery(sql: string, options: QueryOptions): Promise<QueryResult>;
  explainQuery?(sql: string): Promise<ExplainResult>;
}
```

### FR-003: Dependency Graph

Graph data chuẩn hóa:

```ts
type DependencyGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

type GraphNode = {
  id: string;
  label: string;
  type: "table" | "view" | "procedure" | "function" | "trigger" | "column";
  schema?: string;
  database?: string;
  meta?: Record<string, unknown>;
};

type GraphEdge = {
  id: string;
  source: string;
  target: string;
  type: "foreign_key" | "view_reference" | "procedure_reference" | "trigger_reference";
  label?: string;
  meta?: Record<string, unknown>;
};
```

### FR-004: Result Grid

Result grid cần:

- Pagination.
- Copy cell/row/table.
- Export CSV/JSON.
- Sort client-side với dataset nhỏ.
- Virtual scroll với dataset lớn.
- Không render toàn bộ 100k rows một lần.

### FR-005: Cache Schema

Cache schema theo connection:

```txt
globalStorage/
└── schema-cache/
    └── <connection-id>.json
```

Có TTL:

```txt
default: 5 phút
manual refresh: luôn fetch lại
```

## 7. Non-functional Requirements

| Mã      | Yêu cầu                                           |
| ------- | ------------------------------------------------- |
| NFR-001 | Không block UI khi query dài                      |
| NFR-002 | Không lưu password plaintext                      |
| NFR-003 | Extension load nhanh, activate theo command/view  |
| NFR-004 | Graph mở được database khoảng 100-300 bảng        |
| NFR-005 | Result grid xử lý tốt 10k rows nhờ virtual scroll |
| NFR-006 | Có log nhưng tự mask secret                       |
| NFR-007 | Có unit test cho adapter và parser                |
| NFR-008 | Có integration test với Docker DB                 |

## 8. Success Metrics

- Kết nối được ít nhất 5 DBMS quan hệ.
- Mở schema tree dưới 3 giây với database vừa.
- Dependency graph mở dưới 5 giây với 200 bảng.
- Không rò mật khẩu vào log.
- Query editor chạy ổn selected/current/all query.
- Người dùng hiểu quan hệ DB nhanh hơn so với click từng bảng.
