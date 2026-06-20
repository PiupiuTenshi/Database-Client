import { describe, expect, it } from "vitest";
import { buildFkGraph, getSubgraph, objectId } from "../../src/services/graphBuilder";
import type { ForeignKeyInfo } from "../../src/core/types";

function fk(
  name: string,
  sourceTable: string,
  sourceCol: string,
  targetTable: string,
  targetCol: string
): ForeignKeyInfo {
  return {
    name,
    source: { schema: "public", table: sourceTable, columns: [sourceCol] },
    target: { schema: "public", table: targetTable, columns: [targetCol] }
  };
}

// orders -> users, order_items -> orders, payments -> orders, order_items -> products
const FKS: ForeignKeyInfo[] = [
  fk("fk1", "orders", "user_id", "users", "id"),
  fk("fk2", "order_items", "order_id", "orders", "id"),
  fk("fk3", "payments", "order_id", "orders", "id"),
  fk("fk4", "order_items", "product_id", "products", "id")
];

describe("buildFkGraph", () => {
  it("creates a node per table and an edge per FK", () => {
    const graph = buildFkGraph(FKS);
    expect(graph.nodes.map((n) => n.id).sort()).toEqual([
      "public.order_items",
      "public.orders",
      "public.payments",
      "public.products",
      "public.users"
    ]);
    expect(graph.edges).toHaveLength(4);
    const e = graph.edges.find((edge) => edge.id.includes("fk1"));
    expect(e).toMatchObject({
      source: "public.orders",
      target: "public.users",
      type: "foreign_key"
    });
    expect(e?.label).toBe("user_id → id");
  });
});

describe("getSubgraph", () => {
  const graph = buildFkGraph(FKS);

  it("outbound depth 1 from orders -> only users", () => {
    const sub = getSubgraph(graph, "public.orders", "outbound", 1);
    expect(sub.nodes.map((n) => n.id).sort()).toEqual(["public.orders", "public.users"]);
  });

  it("inbound depth 1 from orders -> order_items + payments", () => {
    const sub = getSubgraph(graph, "public.orders", "inbound", 1);
    expect(sub.nodes.map((n) => n.id).sort()).toEqual([
      "public.order_items",
      "public.orders",
      "public.payments"
    ]);
  });

  it("both depth 2 from orders reaches products via order_items", () => {
    const sub = getSubgraph(graph, "public.orders", "both", 2);
    expect(sub.nodes.map((n) => n.id)).toContain("public.products");
  });

  it("depth 1 both does not reach products", () => {
    const sub = getSubgraph(graph, "public.orders", "both", 1);
    expect(sub.nodes.map((n) => n.id)).not.toContain("public.products");
  });

  it("only keeps edges between visited nodes", () => {
    const sub = getSubgraph(graph, "public.orders", "outbound", 1);
    expect(
      sub.edges.every((e) => e.source === "public.orders" || e.target === "public.orders")
    ).toBe(true);
  });
});

describe("objectId", () => {
  it("qualifies with schema when present", () => {
    expect(objectId("public", "t")).toBe("public.t");
    expect(objectId(undefined, "t")).toBe("t");
  });
});
