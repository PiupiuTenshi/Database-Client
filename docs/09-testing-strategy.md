# 09 — Testing Strategy

## 1. Mục tiêu test

Extension database client cần test kỹ vì lỗi có thể gây:

- Mất dữ liệu.
- Query nhầm database.
- Lộ password.
- Hiển thị sai dependency.
- Result grid treo VS Code.
- Adapter DBMS hoạt động không đồng nhất.

## 2. Test Pyramid

```txt
Unit Test
  ↑ nhiều nhất
Integration Test
  ↑ vừa
VS Code Extension E2E Test
  ↑ ít nhưng quan trọng
Manual Test
  ↑ trước release
```

## 3. Unit Test

Dùng cho:

- Parser current SQL.
- Mask secret.
- Normalize error.
- Build dependency graph.
- Subgraph depth.
- Cycle detection.
- Query safety warning.
- Quote identifier.
- Pagination SQL builder.

Ví dụ test graph:

```ts
describe("DependencyGraphService", () => {
  it("builds FK graph", () => {
    const graph = buildFkGraph([
      {
        name: "fk_order_user",
        source: { schema: "public", table: "orders", columns: ["user_id"] },
        target: { schema: "public", table: "users", columns: ["id"] }
      }
    ]);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].source).toBe("public.orders");
    expect(graph.edges[0].target).toBe("public.users");
  });
});
```

## 4. Integration Test với Docker

Dùng Docker Compose để tạo DB test.

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: nexus_test
    ports:
      - "5432:5432"

  mysql:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: mysql
      MYSQL_DATABASE: nexus_test
    ports:
      - "3306:3306"

  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      ACCEPT_EULA: "Y"
      MSSQL_SA_PASSWORD: "YourStrong!Passw0rd"
    ports:
      - "1433:1433"
```

## 5. Test Schema

Dùng schema mẫu giống web bán hàng:

```sql
CREATE TABLE users (
  id INT PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE products (
  id INT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL
);

CREATE TABLE orders (
  id INT PRIMARY KEY,
  user_id INT NOT NULL,
  created_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE order_items (
  id INT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
```

Expected graph:

```txt
orders -> users
order_items -> orders
order_items -> products
```

## 6. Adapter Contract Test

Mỗi adapter phải pass cùng bộ test:

```ts
type AdapterContractTest = {
  testConnection: () => Promise<void>;
  listTables: () => Promise<void>;
  listColumns: () => Promise<void>;
  listForeignKeys: () => Promise<void>;
  executeSelect: () => Promise<void>;
  executeInvalidSql: () => Promise<void>;
};
```

Mục tiêu:

- Đảm bảo DBMS khác nhau nhưng output chuẩn hóa giống nhau.
- Dễ thêm adapter mới.

## 7. VS Code Extension E2E Test

Dùng `@vscode/test-electron`.

Test:

- Extension activate.
- Command tồn tại.
- TreeView provider load.
- Open query command.
- Webview panel mở.
- Context menu command registered.

Không cần test UI pixel-perfect.

## 8. Manual Test Checklist

### Connection

- [ ] Add connection.
- [ ] Test connection đúng.
- [ ] Test connection sai password.
- [ ] Edit connection.
- [ ] Delete connection.
- [ ] Password không xuất hiện trong settings/log.

### Schema Tree

- [ ] Load database.
- [ ] Load schema.
- [ ] Load table.
- [ ] Load column.
- [ ] Refresh.
- [ ] Search table.

### Query

- [ ] Run selected query.
- [ ] Run current query.
- [ ] Run all.
- [ ] Query lỗi hiển thị rõ.
- [ ] Query lớn không treo.
- [ ] Cancel query.

### Result Grid

- [ ] Copy cell.
- [ ] Copy row.
- [ ] Export CSV.
- [ ] Export JSON.
- [ ] Sort/filter.
- [ ] NULL hiển thị đúng.

### Dependency Graph

- [ ] Open graph từ table.
- [ ] Inbound đúng.
- [ ] Outbound đúng.
- [ ] Depth đúng.
- [ ] Search node.
- [ ] Click node mở table.
- [ ] Export JSON.

## 9. Security Test

- [ ] Password không có trong profile JSON.
- [ ] Password không có trong log.
- [ ] Webview không nhận password.
- [ ] CSP có nonce.
- [ ] Query history không lưu result data.
- [ ] Production write query có confirm.
- [ ] Dangerous query warning hoạt động.

## 10. Performance Test

Dataset:

- 50 tables.
- 200 tables.
- 500 tables.
- 10k rows result.
- 100k rows export.

Measure:

- Time load schema.
- Time build graph.
- Time render graph.
- Memory usage.
- Extension host responsiveness.

## 11. Regression Test

Mỗi bug fix cần thêm test:

```txt
Bug: SQLite FK graph duplicate edge
Test: should group composite foreign key into one edge
```

## 12. CI

GitHub Actions:

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: nexus_test
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run compile
```
