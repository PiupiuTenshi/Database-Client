import { describe, expect, it, vi } from "vitest";
import type { ConnectionProfile, ObjectRef } from "../../src/core/types";
import { SchemaSearchService } from "../../src/services/SchemaSearchService";
import type { SchemaService } from "../../src/services/SchemaService";

const profile = { id: "1", name: "db", database: "app" } as ConnectionProfile;

function fakeSchema(): SchemaService {
  return {
    listTables: vi.fn().mockResolvedValue([
      { name: "users", type: "base_table" },
      { name: "orders", type: "base_table" }
    ]),
    listViews: vi.fn().mockResolvedValue([{ name: "user_summary", type: "view" }]),
    listColumns: vi.fn().mockImplementation((_p: ConnectionProfile, ref: ObjectRef) =>
      Promise.resolve(
        ref.name === "orders"
          ? [
              {
                name: "user_id",
                dataType: "int",
                ordinal: 1,
                nullable: false,
                isPrimaryKey: false
              }
            ]
          : [{ name: "id", dataType: "int", ordinal: 1, nullable: false, isPrimaryKey: true }]
      )
    )
  } as unknown as SchemaService;
}

describe("SchemaSearchService", () => {
  it("matches tables, views and columns by name", async () => {
    const svc = new SchemaSearchService(fakeSchema());
    const hits = await svc.search(profile, "app", "user");
    const kinds = hits.map((h) => `${h.kind}:${h.table}${h.column ? "." + h.column : ""}`);
    expect(kinds).toContain("table:users");
    expect(kinds).toContain("view:user_summary");
    expect(kinds).toContain("column:orders.user_id");
  });

  it("returns nothing for an empty term", async () => {
    const svc = new SchemaSearchService(fakeSchema());
    expect(await svc.search(profile, "app", "  ")).toEqual([]);
  });
});
