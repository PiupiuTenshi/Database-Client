import * as vscode from "vscode";
import { EXTENSION_DISPLAY_NAME } from "../../core/constants";
import type { ConnectionProfile } from "../../core/types";
import type { DashboardService } from "../../services/DashboardService";
import { isProduction } from "../../utils/productionGuard";
import { buildCsp, getNonce } from "../WebviewBase";
import { commonStyles } from "../webviewStyles";

/** Webview dashboard tổng quan cho một connection. */
export class DashboardPanel {
  private static readonly panels = new Map<string, DashboardPanel>();
  private readonly disposables: vscode.Disposable[] = [];

  static show(
    dashboardService: DashboardService,
    profile: ConnectionProfile,
    schema?: string
  ): void {
    const existing = DashboardPanel.panels.get(profile.id);
    if (existing) {
      existing.panel.reveal(vscode.ViewColumn.Active);
      void existing.refresh();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "openDbNexus.dashboard",
      `Dashboard — ${profile.name}`,
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    DashboardPanel.panels.set(
      profile.id,
      new DashboardPanel(panel, dashboardService, profile, schema)
    );
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly dashboardService: DashboardService,
    private readonly profile: ConnectionProfile,
    private readonly schema: string | undefined
  ) {
    this.panel.webview.html = this.buildHtml(this.panel.webview);
    this.panel.webview.onDidReceiveMessage(
      (message: { type: string }) => {
        if (message.type === "ready" || message.type === "reload") {
          void this.refresh();
        }
      },
      undefined,
      this.disposables
    );
    this.panel.onDidDispose(() => this.dispose(), undefined, this.disposables);
  }

  private async refresh(): Promise<void> {
    try {
      const metrics = await this.dashboardService.collect(this.profile, this.schema);
      void this.panel.webview.postMessage({ type: "metrics", payload: metrics });
    } catch (error) {
      void this.panel.webview.postMessage({
        type: "error",
        payload: { message: error instanceof Error ? error.message : String(error) }
      });
    }
  }

  private buildHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const csp = buildCsp(webview.cspSource, nonce);
    const prod = isProduction(this.profile)
      ? `<div class="banner prod">⚠ PRODUCTION connection.</div>`
      : "";
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${EXTENSION_DISPLAY_NAME}</title>
${commonStyles(nonce)}
<style nonce="${nonce}">
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 12px;
    padding: 16px;
  }
  .card {
    border: 1px solid var(--border-soft);
    border-radius: 8px;
    padding: 15px;
    background: color-mix(in srgb, var(--surface) 78%, transparent);
    box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset;
    transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
  }
  .card:hover {
    transform: translateY(-1px);
    border-color: var(--vscode-focusBorder);
    background: color-mix(in srgb, var(--surface) 88%, var(--vscode-editor-background) 12%);
  }
  .card .num { font-size: 28px; line-height: 32px; font-weight: 750; letter-spacing: 0; }
  .card .lbl { color: var(--muted); font-size: 12px; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.04em; }
  .meta {
    margin: 0 16px 16px;
    padding: 11px 12px;
    color: var(--muted);
    font-size: 12px;
    word-break: break-word;
    border: 1px solid var(--border-soft);
    border-radius: 8px;
    background: color-mix(in srgb, var(--surface) 72%, transparent);
  }
</style>
</head>
<body>
  <div class="toolbar">
    <span class="title">▣ Dashboard</span>
    <button class="btn" id="reload">⟳ Reload</button>
    <span class="spacer"></span>
    <span class="subtle" id="conn"></span>
  </div>
  ${prod}
  <div id="body" class="msg">Loading…</div>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  $("reload").addEventListener("click", () => vscode.postMessage({ type:"reload" }));
  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (msg.type === "error") { $("body").className="err"; $("body").textContent = msg.payload.message; return; }
    const m = msg.payload;
    $("conn").textContent = m.dbType + (m.schema ? " · " + m.schema : "");
    const cards = [
      { num: m.tableCount, lbl: "Tables" },
      { num: m.viewCount, lbl: "Views" }
    ].map((c) => '<div class="card"><div class="num">'+c.num+'</div><div class="lbl">'+esc(c.lbl)+'</div></div>').join("");
    $("body").className = "";
    $("body").innerHTML = '<div class="cards">'+cards+'</div>' + (m.version ? '<div class="meta"><b>Server:</b> '+esc(m.version)+'</div>' : '');
  });
  vscode.postMessage({ type: "ready" });
</script>
</body>
</html>`;
  }

  private dispose(): void {
    DashboardPanel.panels.delete(this.profile.id);
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }
}
