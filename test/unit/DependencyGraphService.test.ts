import { describe, expect, it } from "vitest";
import { DependencyGraphService } from "../../src/services/DependencyGraphService";
import type { SchemaService } from "../../src/services/SchemaService";
import type { ConnectionProfile, ForeignKeyInfo, TableInfo } from "../../src/core/types";

const profile = { id: "p", name: "pg", dbType: "postgresql" } as ConnectionProfile;

const tables: TableInfo[] = [
  { name: "orders", schema: "public", type: "base_table" },
  { name: "order_items", schema: "public", type: "base_table" },
  { name: "users", schema: "public", type: "base_table" },
  { name: "products", schema: "public", type: "base_table" },
  { name: "audit", schema: "public", type: "base_table" }
];

function fk(name: string, src: string, srcCol: string, tgt: string): ForeignKeyInfo {
  return {
    name,
    source: { schema: "public", table: src, columns: [srcCol] },
    target: { table: tgt, columns: ["id"] }
  };
}

const fksByTable: Record<string, ForeignKeyInfo[]> = {
  orders: [fk("fk1", "orders", "user_id", "users")],
  order_items: [
    fk("fk2", "order_items", "order_id", "orders"),
    fk("fk4", "order_items", "product_id", "products")
  ],
  payments: [],
  users: [],
  products: [],
  audit: []
};

function makeService(): DependencyGraphService {
  const fake = {
    listTables: () => Promise.resolve(tables),
    listViews: () => Promise.resolve([]),
    listViewDependencies: () => Promise.resolve([]),
    listForeignKeys: (_p: ConnectionProfile, ref: { name: string }) =>
      Promise.resolve(fksByTable[ref.name] ?? [])
  } as unknown as SchemaService;
  return new DependencyGraphService(fake);
}

describe("DependencyGraphService", () => {
  it("builds an outbound depth-1 graph around a table", async () => {
    const graph = await makeService().build(
      profile,
      { schema: "public", name: "orders" },
      "outbound",
      1
    );
    expect(graph.center).toBe("public.orders");
    expect(graph.nodes.map((n) => n.id).sort()).toEqual(["public.orders", "public.users"]);
  });

  it("includes the center node even when isolated", async () => {
    const graph = await makeService().build(
      profile,
      { schema: "public", name: "audit" },
      "both",
      2
    );
    expect(graph.nodes.map((n) => n.id)).toEqual(["public.audit"]);
  });

  it("normalizes target schema so ids stay consistent", async () => {
    const graph = await makeService().build(
      profile,
      { schema: "public", name: "order_items" },
      "outbound",
      1
    );
    // order_items -> orders, products (targets had no schema, should be qualified to public)
    expect(graph.nodes.map((n) => n.id).sort()).toEqual([
      "public.order_items",
      "public.orders",
      "public.products"
    ]);
  });
});
