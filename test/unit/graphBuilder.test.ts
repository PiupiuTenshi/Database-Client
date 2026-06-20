import { describe, expect, it } from "vitest";
import {
  appendViewDependencies,
  buildFkGraph,
  buildImpactReport,
  detectCycles,
  getSubgraph,
  objectId
} from "../../src/services/graphBuilder";
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

describe("appendViewDependencies", () => {
  it("adds view nodes and view_reference edges", () => {
    const base = buildFkGraph(FKS);
    const merged = appendViewDependencies(base, [
      {
        view: { schema: "public", name: "v_orders" },
        references: [
          { schema: "public", name: "orders" },
          { schema: "public", name: "users" }
        ]
      }
    ]);
    const viewNode = merged.nodes.find((n) => n.id === "public.v_orders");
    expect(viewNode?.type).toBe("view");
    const viewEdges = merged.edges.filter((e) => e.type === "view_reference");
    expect(viewEdges).toHaveLength(2);
    expect(viewEdges.every((e) => e.source === "public.v_orders")).toBe(true);
  });
});

describe("detectCycles", () => {
  it("returns nothing for an acyclic FK graph", () => {
    expect(detectCycles(buildFkGraph(FKS))).toEqual([]);
  });

  it("detects a cycle A -> B -> A", () => {
    const graph = buildFkGraph([
      fk("c1", "a", "b_id", "b", "id"),
      fk("c2", "b", "a_id", "a", "id")
    ]);
    const cycles = detectCycles(graph);
    expect(cycles.length).toBeGreaterThan(0);
  });
});

describe("buildImpactReport", () => {
  it("lists dependencies, dependents and impact", () => {
    const md = buildImpactReport(buildFkGraph(FKS), "public.orders");
    expect(md).toContain("# Dependency Report: public.orders");
    expect(md).toContain("orders depends on");
    expect(md).toContain("users"); // outbound
    expect(md).toContain("order_items"); // inbound / impact
  });
});
