import { describe, expect, it } from "vitest";
import {
  buildCliInstallCandidates,
  buildInstallCommand,
  compareVersions
} from "../../src/services/UpdateService";

describe("UpdateService", () => {
  it("compares semantic versions with or without v prefix", () => {
    expect(compareVersions("v1.14.0", "1.13.0")).toBe(1);
    expect(compareVersions("1.13.0", "v1.13.0")).toBe(0);
    expect(compareVersions("1.9.0", "1.10.0")).toBe(-1);
  });

  it("prefers the VS Code CLI command before process.execPath on Windows", () => {
    expect(buildCliInstallCandidates("win32", "D:\\VS Code\\Code.exe")).toEqual([
      "code.cmd",
      "code",
      "D:\\VS Code\\Code.exe"
    ]);
  });

  it("builds a copyable PowerShell install command that uses code from PATH", () => {
    expect(buildInstallCommand("C:\\Temp\\open-db-nexus-1.14.1.vsix")).toBe(
      "code --install-extension 'C:\\Temp\\open-db-nexus-1.14.1.vsix' --force"
    );
  });
});
