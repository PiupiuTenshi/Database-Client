# 05 — Dependency Graph Design

## 1. Mục tiêu

Dependency Graph giúp người dùng nhìn quan hệ giữa các database object mà không phải mở từng bảng.

### Trạng thái triển khai (v1.1.0)

- ✅ FK graph, inbound/outbound/both, depth `1/2/3/all`, search/focus và double-click mở table data.
- ✅ Export JSON/SVG; cảnh báo graph lớn; cycle detection và Markdown impact report.
- ✅ View dependency cho PostgreSQL và SQL Server (cạnh nét đứt).
- ⏳ Procedure/function/trigger dependency, PNG export, centrality, mini-map và layout nâng cao — xem [12-future-features.md](12-future-features.md).

Ví dụ với hệ thống bán hàng:

```txt
users ──< orders ──< order_items >── products
orders ──< payments
products ──< inventory_logs
```

Khi click `orders`, user cần thấy:

- `orders` phụ thuộc vào `users`.
- `order_items` phụ thuộc vào `orders`.
- `payments` phụ thuộc vào `orders`.
- View/procedure nào đọc hoặc ghi `orders`.

## 2. Loại dependency

### 2.1 Foreign Key Dependency

Quan hệ phổ biến nhất:

```txt
child_table.foreign_key -> parent_table.primary_key
```

Ví dụ:

```txt
order_items.order_id -> orders.id
```

Graph edge:

```json
{
  "source": "public.order_items",
  "target": "public.orders",
  "type": "foreign_key",
  "label": "order_id → id"
}
```

### 2.2 View Dependency

View có thể tham chiếu nhiều table:

```sql
CREATE VIEW v_order_summary AS
SELECT o.id, u.name, SUM(oi.quantity * oi.price)
FROM orders o
JOIN users u ON u.id = o.user_id
JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id, u.name;
```

Graph:

```txt
v_order_summary -> orders
v_order_summary -> users
v_order_summary -> order_items
```

### 2.3 Procedure/Function Dependency

Procedure có thể:

- SELECT từ table.
- INSERT/UPDATE/DELETE table.
- Gọi procedure khác.

Graph edge có thể phân loại:

```txt
reads
writes
calls
```

### 2.4 Trigger Dependency

Trigger gắn với table và có thể ghi sang bảng khác.

Ví dụ:

```txt
orders_trigger -> orders
orders_trigger -> audit_logs
```

## 3. Graph Data Model

```ts
export type GraphObjectType = "table" | "view" | "procedure" | "function" | "trigger" | "column";

export type GraphEdgeType =
  | "foreign_key"
  | "view_reference"
  | "procedure_read"
  | "procedure_write"
  | "procedure_call"
  | "trigger_on"
  | "trigger_write";

export type GraphNode = {
  id: string;
  label: string;
  type: GraphObjectType;
  database?: string;
  schema?: string;
  objectName: string;
  metrics?: {
    inboundCount?: number;
    outboundCount?: number;
    rowEstimate?: number;
  };
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  type: GraphEdgeType;
  label?: string;
  columns?: {
    sourceColumns?: string[];
    targetColumns?: string[];
  };
};

export type DependencyGraph = {
  center?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  warnings?: string[];
};
```

## 4. Direction Semantics

Cần thống nhất ý nghĩa mũi tên.

Đề xuất:

```txt
source depends on target
```

Ví dụ:

```txt
order_items -> orders
```

Nghĩa là `order_items` phụ thuộc vào `orders`.

Ưu điểm:

- Khi muốn biết object hiện tại phụ thuộc ai: xem outgoing edge.
- Khi muốn biết ai phụ thuộc object hiện tại: xem incoming edge.

## 5. Inbound / Outbound

Với object `orders`:

### Outbound

```txt
orders -> users
```

Nghĩa là `orders` cần `users`.

### Inbound

```txt
order_items -> orders
payments -> orders
```

Nghĩa là các bảng khác cần `orders`.

## 6. Depth

### Depth 1

Chỉ object trực tiếp liên quan.

```txt
users <- orders -> order_items
```

### Depth 2

Lấy tiếp dependency của dependency.

```txt
roles <- users <- orders -> order_items -> products
```

### All

Lấy toàn bộ schema. Cẩn thận với database lớn.

## 7. Graph Options

```ts
export type GraphOptions = {
  direction: "inbound" | "outbound" | "both";
  depth: 1 | 2 | 3 | "all";
  includeTables: boolean;
  includeViews: boolean;
  includeProcedures: boolean;
  includeTriggers: boolean;
  includeColumns: boolean;
  collapseColumns: boolean;
  layout: "dagre" | "force" | "circle" | "grid";
};
```

## 8. Algorithm Build Graph từ FK

Input:

```ts
ForeignKeyInfo[]
```

Algorithm:

```ts
function buildFkGraph(fks: ForeignKeyInfo[]): DependencyGraph {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  for (const fk of fks) {
    const sourceId = objectId(fk.source);
    const targetId = objectId(fk.target);

    nodes.set(sourceId, tableNode(fk.source));
    nodes.set(targetId, tableNode(fk.target));

    edges.push({
      id: `fk:${fk.name}:${sourceId}:${targetId}`,
      source: sourceId,
      target: targetId,
      type: "foreign_key",
      label: `${fk.source.columns.join(", ")} → ${fk.target.columns.join(", ")}`
    });
  }

  return {
    nodes: [...nodes.values()],
    edges
  };
}
```

## 9. Algorithm Lấy Subgraph Theo Center Node

```ts
function getSubgraph(
  graph: DependencyGraph,
  centerId: string,
  direction: "inbound" | "outbound" | "both",
  depth: number
): DependencyGraph {
  const adjacency = buildAdjacency(graph.edges, direction);
  const visited = new Set<string>([centerId]);
  const queue: Array<{ id: string; level: number }> = [{ id: centerId, level: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.level >= depth) continue;

    for (const next of adjacency.get(current.id) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push({ id: next, level: current.level + 1 });
    }
  }

  const nodes = graph.nodes.filter((n) => visited.has(n.id));
  const edges = graph.edges.filter((e) => visited.has(e.source) && visited.has(e.target));

  return { center: centerId, nodes, edges };
}
```

## 10. UI Graph

Nên dùng Webview vì graph cần canvas/SVG và interaction phức tạp.

### Công nghệ gợi ý

| Library      | Ưu điểm                      | Nhược điểm                 |
| ------------ | ---------------------------- | -------------------------- |
| Cytoscape.js | Mạnh cho graph, nhiều layout | Custom UI hơi nhiều        |
| React Flow   | UI đẹp, node custom dễ       | Hợp workflow hơn graph lớn |
| D3.js        | Tùy biến cao                 | Tốn công                   |
| Mermaid      | Nhanh cho docs               | Không đủ interactive       |

Đề xuất:

```txt
Hiện tại: custom SVG Webview, không thêm dependency runtime.
Nếu graph cực lớn: cân nhắc Cytoscape.js cho layout/virtualization.
Nếu cần workflow editor: cân nhắc React Flow.
```

## 11. Tính năng UI cần có

- Zoom in/out và pan canvas.
- Fit view theo bounding box thực tế.
- Search node theo table/view/schema.
- Click node mở detail panel.
- Click edge mở source/target/column mapping.
- Double click node mở table.
- Filter object type.
- Toggle inbound/outbound.
- Toggle depth.
- Export SVG.
- Copy/export graph JSON.
- Highlight quan hệ trực tiếp của node/edge đang chọn.
- Show mini-map nếu dùng React Flow.
- Legend giải thích FK/view-reference.
- Header stats: nodes, edges, tables/views, FK/view-reference.

## 12. Node Detail Panel

Khi click node:

```txt
Name: public.orders
Type: table
Incoming Dependencies: 2
Outgoing Dependencies: 1
Actions:
  - Open Table
Related edges:
  - order_items -> orders via order_id -> id
  - user_order_counts -> orders via view reference
```

## 13. Edge Detail Panel

Khi click edge:

```txt
Type: foreign_key
Name: fk_order_items_order_id
From: order_items.order_id
To: orders.id
Actions:
  - Open Source Table
  - Open Target Table
```

## 14. Handling Large Schema

Vấn đề:

- Graph 500 bảng rất rối.
- Render toàn schema có thể lag.
- User cần focus.

Giải pháp:

- Mặc định depth = 2.
- Có warning khi full schema > 300 nodes.
- Có search trước rồi focus.
- Có group theo schema/module.
- Có collapse node ít liên quan.
- Có filter chỉ FK / only tables.

## 15. Phân tích nâng cao sau MVP

### Centrality

Tính bảng quan trọng:

```txt
score = inboundCount * 2 + outboundCount
```

Bảng có score cao thường là core table.

### Impact Analysis

Khi user chọn `Drop/Alter Table Impact`:

- Tìm tất cả inbound dependencies.
- Tìm view/procedure có reference.
- Xuất report Markdown.

### Circular Dependency Detection

Detect cycle bằng DFS:

```txt
A -> B -> C -> A
```

Hiển thị warning:

```txt
Circular FK dependency detected.
```

## 16. Output Markdown Report

Extension có thể sinh file:

```md
# Dependency Report: public.orders

## Direct Dependencies

### orders depends on

- users via `orders.user_id -> users.id`

### depends on orders

- order_items via `order_items.order_id -> orders.id`
- payments via `payments.order_id -> orders.id`

## Impact

Changing `orders.id` may affect:

- order_items.order_id
- payments.order_id
- v_order_summary
```
