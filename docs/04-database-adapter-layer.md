# 04 — Database Adapter Layer

## 1. Vì sao cần Adapter Layer?

Mỗi DBMS có:

- Driver riêng.
- SQL metadata riêng.
- Kiểu dữ liệu riêng.
- Cách phân trang khác nhau.
- Cách lấy foreign key khác nhau.
- Cách lấy view/procedure dependency khác nhau.

Nếu UI gọi thẳng driver, code sẽ rất rối. Adapter layer giúp chuẩn hóa dữ liệu để UI và service dùng chung.

## 2. DBMS ưu tiên và trạng thái

### Đã phát hành đến v1.1.0

| DBMS          | Lý do                                 |
| ------------- | ------------------------------------- |
| SQLite        | Dễ test, không cần server — ✅        |
| PostgreSQL    | Mạnh, metadata tốt — ✅               |
| MySQL/MariaDB | Phổ biến với web/backend — ✅         |
| SQL Server    | Phổ biến ở trường/doanh nghiệp — ✅   |
| Redis         | Key-value command console — ✅ cơ bản |

### Backlog adapter tiếp theo

| DBMS    | Lý do                                        |
| ------- | -------------------------------------------- |
| DuckDB  | Query file Parquet/CSV/JSON, analytics local |
| MongoDB | NoSQL document                               |
| Oracle  | Nhiều hệ thống doanh nghiệp                  |

### Backlog dài hạn

| DBMS          | Lý do                                              |
| ------------- | -------------------------------------------------- |
| ClickHouse    | Analytics                                          |
| Elasticsearch | Search engine                                      |
| Snowflake     | Cloud warehouse                                    |
| Kafka         | Message/event explorer, không phải DB truyền thống |

## 3. Type chung

```ts
export type DbType =
  | "mysql"
  | "mariadb"
  | "postgresql"
  | "sqlserver"
  | "sqlite"
  | "duckdb"
  | "mongodb"
  | "redis"
  | "oracle";

export type ObjectType =
  | "database"
  | "schema"
  | "table"
  | "view"
  | "column"
  | "index"
  | "foreign_key"
  | "procedure"
  | "function"
  | "trigger";
```

## 4. Connection Profile

```ts
export type ConnectionProfile = {
  id: string;
  name: string;
  dbType: DbType;

  host?: string;
  port?: number;
  username?: string;
  database?: string;

  filePath?: string;

  ssl?: {
    enabled: boolean;
    rejectUnauthorized?: boolean;
    caPath?: string;
    certPath?: string;
    keyPath?: string;
  };

  sshTunnel?: {
    enabled: boolean;
    host: string;
    port: number;
    username: string;
    privateKeyPath?: string;
  };

  tags: string[];
  color?: string;
  createdAt: string;
  updatedAt: string;
};
```

## 5. Secret Key Convention

Không lưu password trong `ConnectionProfile`.

```ts
function getPasswordSecretKey(connectionId: string) {
  return `openDbNexus.connection.${connectionId}.password`;
}
```

Với SSH:

```ts
function getSshPasswordSecretKey(connectionId: string) {
  return `openDbNexus.connection.${connectionId}.sshPassword`;
}
```

## 6. Adapter Interface

```ts
export interface DatabaseAdapter {
  readonly type: DbType;

  connect(profile: RuntimeConnectionProfile): Promise<DbSession>;

  testConnection(profile: RuntimeConnectionProfile): Promise<TestConnectionResult>;

  disconnect(session: DbSession): Promise<void>;

  listDatabases(session: DbSession): Promise<DatabaseInfo[]>;

  listSchemas(session: DbSession, database?: string): Promise<SchemaInfo[]>;

  listTables(session: DbSession, input: ListObjectsInput): Promise<TableInfo[]>;

  listViews(session: DbSession, input: ListObjectsInput): Promise<ViewInfo[]>;

  listColumns(session: DbSession, table: ObjectRef): Promise<ColumnInfo[]>;

  listIndexes(session: DbSession, table: ObjectRef): Promise<IndexInfo[]>;

  listForeignKeys(session: DbSession, input: ForeignKeyInput): Promise<ForeignKeyInfo[]>;

  getObjectDDL(session: DbSession, ref: ObjectRef): Promise<string>;

  executeQuery(session: DbSession, sql: string, options: QueryOptions): Promise<QueryResult>;

  explainQuery?(session: DbSession, sql: string): Promise<ExplainResult>;
}
```

## 7. Metadata Models

### DatabaseInfo

```ts
export type DatabaseInfo = {
  name: string;
  owner?: string;
  encoding?: string;
};
```

### SchemaInfo

```ts
export type SchemaInfo = {
  name: string;
  database?: string;
};
```

### TableInfo

```ts
export type TableInfo = {
  name: string;
  schema?: string;
  database?: string;
  type: "base_table" | "temporary_table" | "external_table";
  rowEstimate?: number;
  comment?: string;
};
```

### ColumnInfo

```ts
export type ColumnInfo = {
  name: string;
  dataType: string;
  ordinal: number;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  maxLength?: number;
  precision?: number;
  scale?: number;
  comment?: string;
};
```

### ForeignKeyInfo

```ts
export type ForeignKeyInfo = {
  name: string;

  source: {
    database?: string;
    schema?: string;
    table: string;
    columns: string[];
  };

  target: {
    database?: string;
    schema?: string;
    table: string;
    columns: string[];
  };

  onUpdate?: string;
  onDelete?: string;
};
```

## 8. Metadata Query Examples

### PostgreSQL foreign keys

```sql
SELECT
  tc.constraint_name,
  tc.table_schema AS source_schema,
  tc.table_name AS source_table,
  kcu.column_name AS source_column,
  ccu.table_schema AS target_schema,
  ccu.table_name AS target_table,
  ccu.column_name AS target_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY';
```

### MySQL foreign keys

```sql
SELECT
  CONSTRAINT_NAME,
  TABLE_SCHEMA AS source_schema,
  TABLE_NAME AS source_table,
  COLUMN_NAME AS source_column,
  REFERENCED_TABLE_SCHEMA AS target_schema,
  REFERENCED_TABLE_NAME AS target_table,
  REFERENCED_COLUMN_NAME AS target_column
FROM information_schema.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_NAME IS NOT NULL;
```

### SQL Server foreign keys

```sql
SELECT
  fk.name AS constraint_name,
  OBJECT_SCHEMA_NAME(fkc.parent_object_id) AS source_schema,
  OBJECT_NAME(fkc.parent_object_id) AS source_table,
  pc.name AS source_column,
  OBJECT_SCHEMA_NAME(fkc.referenced_object_id) AS target_schema,
  OBJECT_NAME(fkc.referenced_object_id) AS target_table,
  rc.name AS target_column
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc
  ON fk.object_id = fkc.constraint_object_id
JOIN sys.columns pc
  ON fkc.parent_object_id = pc.object_id
 AND fkc.parent_column_id = pc.column_id
JOIN sys.columns rc
  ON fkc.referenced_object_id = rc.object_id
 AND fkc.referenced_column_id = rc.column_id;
```

### SQLite foreign keys

SQLite lấy FK theo từng bảng:

```sql
PRAGMA foreign_key_list('table_name');
```

Vì vậy SQLite adapter cần:

1. List tất cả table.
2. Loop từng table.
3. Chạy `PRAGMA foreign_key_list`.
4. Chuẩn hóa thành `ForeignKeyInfo[]`.

## 9. Query Pagination Strategy

| DBMS          | Pagination                             |
| ------------- | -------------------------------------- |
| PostgreSQL    | `LIMIT n OFFSET m`                     |
| MySQL/MariaDB | `LIMIT m, n` hoặc `LIMIT n OFFSET m`   |
| SQL Server    | `OFFSET m ROWS FETCH NEXT n ROWS ONLY` |
| SQLite        | `LIMIT n OFFSET m`                     |
| Oracle        | `OFFSET m ROWS FETCH NEXT n ROWS ONLY` |

Không nên tự động append pagination vào mọi query vì có thể phá query phức tạp. MVP có thể:

- Với table viewer: extension tự sinh query có pagination.
- Với query editor: chạy đúng SQL user viết, chỉ cảnh báo nếu result quá lớn.

## 10. Error Normalization

Driver error cần chuẩn hóa:

```ts
export type DbError = {
  message: string;
  code?: string;
  detail?: string;
  position?: number;
  hint?: string;
  severity?: string;
  original?: unknown;
};
```

Không show stack trace dài cho user mặc định. Có nút `Copy Details`.

## 11. Adapter Folder Structure

```txt
src/adapters/
├── DatabaseAdapter.ts
├── AdapterRegistry.ts
├── common/
│   ├── normalizeError.ts
│   ├── quoteIdentifier.ts
│   ├── pagination.ts
│   └── metadataTypes.ts
├── mysql/
│   ├── MySqlAdapter.ts
│   └── mysqlMetadataQueries.ts
├── postgresql/
│   ├── PostgresAdapter.ts
│   └── postgresMetadataQueries.ts
├── sqlserver/
│   ├── SqlServerAdapter.ts
│   └── sqlServerMetadataQueries.ts
├── sqlite/
│   ├── SqliteAdapter.ts
│   └── sqliteMetadataQueries.ts
└── redis/
    └── RedisAdapter.ts
```

## 12. Thứ tự implement adapter

Nên làm:

1. ✅ SQLite adapter.
2. ✅ PostgreSQL adapter.
3. ✅ MySQL/MariaDB adapter.
4. ✅ SQL Server adapter.
5. ✅ Redis adapter cơ bản (không áp dụng table/schema graph SQL).
6. ⏳ DuckDB adapter.
7. ⏳ MongoDB adapter.
8. ⏳ Oracle adapter.

Lý do:

- SQLite test nhanh.
- PostgreSQL metadata rõ.
- MySQL phổ biến.
- SQL Server hơi nhiều metadata đặc thù.
- NoSQL vẫn để phase sau cho UI/schema nâng cao vì mô hình dữ liệu khác SQL. Redis đã có command console nền tảng; key viewer theo type là backlog `v1.x` trong [12-future-features.md](12-future-features.md).
