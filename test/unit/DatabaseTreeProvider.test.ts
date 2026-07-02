import { describe, expect, it, vi } from "vitest";
import type { ConnectionProfile } from "../../src/core/types";
import type { ConnectionService } from "../../src/services/ConnectionService";
import type { DashboardService } from "../../src/services/DashboardService";
import type { SchemaService } from "../../src/services/SchemaService";
import type { SessionManager } from "../../src/services/SessionManager";
import { DatabaseTreeProvider } from "../../src/views/databaseExplorer/DatabaseTreeProvider";
import { ConnectionNode } from "../../src/views/databaseExplorer/nodes/ConnectionNode";

const profile = {
  id: "mysql-1",
  name: "mysql",
  dbType: "mysql",
  environment: "local",
  tags: [],
  createdAt: "",
  updatedAt: ""
} as ConnectionProfile;

function provider(getVersion = vi.fn<DashboardService["getVersion"]>()) {
  return {
    tree: new DatabaseTreeProvider(
      { listProfiles: () => [profile] } as unknown as ConnectionService,
      {} as SchemaService,
      { supports: () => true } as unknown as SessionManager,
      { getVersion } as unknown as DashboardService
    ),
    getVersion
  };
}

function rootNodes(tree: DatabaseTreeProvider): ConnectionNode[] {
  return tree.getChildren() as ConnectionNode[];
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("DatabaseTreeProvider", () => {
  it("updates connection descriptions with the loaded database version", async () => {
    const { tree } = provider(vi.fn().mockResolvedValue("MySQL 8.4.8"));

    expect(rootNodes(tree)[0].toTreeItem().description).toBe("MySQL");

    await flushPromises();

    expect(rootNodes(tree)[0].toTreeItem().description).toBe("MySQL 8.4.8");
  });

  it("retries a failed version load after a root refresh", async () => {
    const getVersion = vi
      .fn<DashboardService["getVersion"]>()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce("MySQL 8.4.8");
    const { tree } = provider(getVersion);

    rootNodes(tree);
    await flushPromises();
    rootNodes(tree);
    expect(getVersion).toHaveBeenCalledTimes(1);

    tree.refresh();
    rootNodes(tree);
    await flushPromises();

    expect(getVersion).toHaveBeenCalledTimes(2);
    expect(rootNodes(tree)[0].toTreeItem().description).toBe("MySQL 8.4.8");
  });
});

