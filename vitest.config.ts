import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    alias: {
      // Thay module "vscode" (chỉ có khi chạy trong extension host) bằng mock.
      vscode: fileURLToPath(new URL("./test/mocks/vscode.ts", import.meta.url))
    }
  }
});
