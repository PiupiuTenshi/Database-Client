import * as vscode from "vscode";
import type { Logger } from "./ConnectionService";

const LATEST_RELEASE_URL = "https://api.github.com/repos/PiupiuTenshi/Database-Client/releases/latest";
const RELEASES_PAGE = "https://github.com/PiupiuTenshi/Database-Client/releases/latest";
const LAST_CHECK_KEY = "openDbNexus.updates.lastCheckAt";
const DEFAULT_CHECK_INTERVAL_HOURS = 24;

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  assets: GitHubReleaseAsset[];
}

interface CheckOptions {
  silent?: boolean;
  force?: boolean;
}

export class UpdateService {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logger: Logger
  ) {}

  checkOnStartup(): void {
    const config = vscode.workspace.getConfiguration("openDbNexus");
    if (!config.get<boolean>("updates.autoCheckOnStartup", true)) {
      return;
    }
    void this.checkForUpdates({ silent: true });
  }

  async checkForUpdates(options: CheckOptions = {}): Promise<void> {
    if (!options.force && !this.shouldCheckNow()) {
      return;
    }
    await this.context.globalState.update(LAST_CHECK_KEY, new Date().toISOString());

    let release: GitHubRelease;
    try {
      release = await fetchLatestRelease();
    } catch (error) {
      this.logger.error(`Update check failed: ${toErrorMessage(error)}`);
      if (!options.silent) {
        void vscode.window.showErrorMessage(`Could not check for updates: ${toErrorMessage(error)}`);
      }
      return;
    }

    const currentVersion = this.currentVersion();
    const latestVersion = normalizeVersion(release.tag_name);
    if (compareVersions(latestVersion, currentVersion) <= 0) {
      if (!options.silent) {
        void vscode.window.showInformationMessage(
          `Open DB Nexus is up to date (${currentVersion}).`
        );
      }
      return;
    }

    const asset = release.assets.find((item) => item.name.endsWith(".vsix"));
    const install = "Install Update";
    const open = "Open Release";
    const choice = await vscode.window.showInformationMessage(
      `Open DB Nexus ${latestVersion} is available. Current version: ${currentVersion}.`,
      install,
      open,
      "Later"
    );
    if (choice === install && asset) {
      await this.downloadAndInstall(release, asset);
    } else if (choice === open || (choice === install && !asset)) {
      await vscode.env.openExternal(vscode.Uri.parse(release.html_url || RELEASES_PAGE));
    }
  }

  private async downloadAndInstall(
    release: GitHubRelease,
    asset: GitHubReleaseAsset
  ): Promise<void> {
    try {
      const file = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Downloading Open DB Nexus ${normalizeVersion(release.tag_name)}`,
          cancellable: false
        },
        async () => {
          const response = await fetch(asset.browser_download_url);
          if (!response.ok) {
            throw new Error(`Download failed: ${response.status} ${response.statusText}`);
          }
          const bytes = new Uint8Array(await response.arrayBuffer());
          await vscode.workspace.fs.createDirectory(this.context.globalStorageUri);
          const fileUri = vscode.Uri.joinPath(this.context.globalStorageUri, asset.name);
          await vscode.workspace.fs.writeFile(fileUri, bytes);
          return fileUri;
        }
      );

      await vscode.commands.executeCommand("workbench.extensions.installExtension", file);
      const reload = await vscode.window.showInformationMessage(
        `Open DB Nexus ${normalizeVersion(release.tag_name)} was installed. Reload VS Code to activate it.`,
        "Reload Window",
        "Later"
      );
      if (reload === "Reload Window") {
        await vscode.commands.executeCommand("workbench.action.reloadWindow");
      }
    } catch (error) {
      this.logger.error(`Update install failed: ${toErrorMessage(error)}`);
      const open = await vscode.window.showErrorMessage(
        `Could not install the update automatically: ${toErrorMessage(error)}`,
        "Open Release"
      );
      if (open === "Open Release") {
        await vscode.env.openExternal(vscode.Uri.parse(release.html_url || RELEASES_PAGE));
      }
    }
  }

  private shouldCheckNow(): boolean {
    const intervalHours = vscode.workspace
      .getConfiguration("openDbNexus")
      .get<number>("updates.checkIntervalHours", DEFAULT_CHECK_INTERVAL_HOURS);
    const lastCheckAt = this.context.globalState.get<string>(LAST_CHECK_KEY);
    if (!lastCheckAt) {
      return true;
    }
    const elapsedMs = Date.now() - new Date(lastCheckAt).getTime();
    return elapsedMs >= Math.max(1, intervalHours) * 60 * 60 * 1000;
  }

  private currentVersion(): string {
    const packageJson = this.context.extension.packageJSON as { version?: string };
    return normalizeVersion(packageJson.version ?? "0.0.0");
  }
}

async function fetchLatestRelease(): Promise<GitHubRelease> {
  const response = await fetch(LATEST_RELEASE_URL, {
    headers: { accept: "application/vnd.github+json", "user-agent": "open-db-nexus" }
  });
  if (!response.ok) {
    throw new Error(`GitHub returned ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as GitHubRelease;
}

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, "");
}

export function compareVersions(a: string, b: string): number {
  const left = normalizeVersion(a).split(".").map((part) => Number(part) || 0);
  const right = normalizeVersion(b).split(".").map((part) => Number(part) || 0);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) {
      return diff > 0 ? 1 : -1;
    }
  }
  return 0;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
