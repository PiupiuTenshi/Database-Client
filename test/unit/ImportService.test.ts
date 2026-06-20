import { describe, expect, it, vi } from "vitest";
import type { DataEditService } from "../../src/services/DataEditService";
import { ImportService } from "../../src/services/ImportService";
import type { ConnectionProfile } from "../../src/core/types";

const profile = { id: "1", name: "db" } as ConnectionProfile;
const ref = { name: "users" };

describe("ImportService.plan", () => {
  it("auto-maps CSV headers to table columns case-insensitively", () => {
    const svc = new ImportService({} as DataEditService);
    const plan = svc.plan("ID,Name,extra\n1,Ann,x", ["id", "name"]);
    expect(plan.mapping).toEqual([
      { csvHeader: "ID", column: "id" },
      { csvHeader: "Name", column: "name" },
      { csvHeader: "extra", column: null }
    ]);
    expect(plan.rowCount).toBe(1);
  });
});

describe("ImportService.run", () => {
  it("inserts mapped rows and collects per-row errors", async () => {
    const insertRow = vi
      .fn()
      .mockResolvedValueOnce({ affectedRows: 1 })
      .mockRejectedValueOnce(new Error("constraint violation"))
      .mockResolvedValueOnce({ affectedRows: 1 });
    const svc = new ImportService({ insertRow } as unknown as DataEditService);
    const headers = ["id", "name"];
    const rows = [
      ["1", "Ann"],
      ["2", "Bob"],
      ["3", "Cy"]
    ];
    const mapping = [
      { csvHeader: "id", column: "id" },
      { csvHeader: "name", column: "name" }
    ];
    const result = await svc.run(profile, ref, headers, rows, mapping);
    expect(result.inserted).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(3); // header + 0-index offset
    expect(insertRow).toHaveBeenCalledTimes(3);
  });

  it("throws when nothing maps", async () => {
    const svc = new ImportService({ insertRow: vi.fn() } as unknown as DataEditService);
    await expect(
      svc.run(profile, ref, ["x"], [["1"]], [{ csvHeader: "x", column: null }])
    ).rejects.toThrow(/No CSV columns/);
  });
});
