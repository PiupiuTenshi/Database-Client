import * as vscode from "vscode";
import { EXTENSION_DISPLAY_NAME } from "../../core/constants";
import type { ConnectionProfile, ObjectRef } from "../../core/types";
import type { QueryService } from "../../services/QueryService";
import { buildCsp, getNonce } from "../WebviewBase";

const PAGE_SIZE = 100;

interface IncomingMessage {
  type: "ready" | "prev" | "next";
}

/** Webview hiển thị dữ liệu bảng dạng grid, có phân trang. */
export class TableDataPanel {
  private static readonly panels = new Map<string, TableDataPanel>();

  private readonly disposables: vscode.Disposable[] = [];
  private offset = 0;

  static show(queryService: QueryService, profile: ConnectionProfile, ref: ObjectRef): void {
    const key = `${profile.id}:${ref.schema ?? ""}:${ref.name}`;
    const existing = TableDataPanel.panels.get(key);
    if (existing) {
      existing.panel.reveal(vscode.ViewColumn.Active);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "openDbNexus.tableData",
      `${ref.name} — ${profile.name}`,
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    TableDataPanel.panels.set(key, new TableDataPanel(key, panel, queryService, profile, ref));
  }

  private constructor(
    private readonly key: string,
    private readonly panel: vscode.WebviewPanel,
    private readonly queryService: QueryService,
    private readonly profile: ConnectionProfile,
    private readonly ref: ObjectRef
  ) {
    this.panel.webview.html = this.buildHtml(this.panel.webview);
    this.panel.webview.onDidReceiveMessage(
      (message: IncomingMessage) => void this.handleMessage(message),
      undefined,
      this.disposables
    );
    this.panel.onDidDispose(() => this.dispose(), undefined, this.disposables);
  }

  private async handleMessage(message: IncomingMessage): Promise<void> {
    if (message.type === "next") {
      this.offset += PAGE_SIZE;
    } else if (message.type === "prev") {
      this.offset = Math.max(0, this.offset - PAGE_SIZE);
    }
    await this.loadPage();
  }

  private async loadPage(): Promise<void> {
    try {
      const page = await this.queryService.getTablePage(
        this.profile,
        this.ref,
        PAGE_SIZE,
        this.offset
      );
      void this.panel.webview.postMessage({
        type: "data",
        payload: {
          columns: page.result.columns.map((column) => column.name),
          rows: page.result.rows,
          total: page.total,
          offset: page.offset,
          pageSize: page.limit,
          durationMs: page.result.durationMs
        }
      });
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
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${EXTENSION_DISPLAY_NAME}</title>
<style nonce="${nonce}">
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); margin: 0; padding: 0; }
  .toolbar { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-bottom: 1px solid var(--vscode-panel-border); font-size: 12px; position: sticky; top: 0; background: var(--vscode-editor-background); }
  .toolbar button { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 4px 10px; border-radius: 2px; cursor: pointer; }
  .toolbar button:disabled { opacity: 0.5; cursor: default; }
  .grid-wrap { overflow: auto; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { border: 1px solid var(--vscode-panel-border); padding: 4px 8px; text-align: left; white-space: nowrap; }
  th { position: sticky; top: 0; background: var(--vscode-editorWidget-background); }
  tr:nth-child(even) td { background: var(--vscode-list-hoverBackground); }
  .null { color: var(--vscode-descriptionForeground); font-style: italic; }
  .msg { padding: 16px; color: var(--vscode-descriptionForeground); }
  .err { padding: 16px; color: var(--vscode-errorForeground); }
</style>
</head>
<body>
  <div class="toolbar">
    <button id="prev">◀ Prev</button>
    <button id="next">Next ▶</button>
    <span id="info"></span>
  </div>
  <div class="grid-wrap"><div id="grid" class="msg">Loading…</div></div>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);

  function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  function renderCell(v) {
    if (v === null || v === undefined) return '<td class="null">NULL</td>';
    if (typeof v === "object") return "<td>" + esc(JSON.stringify(v)) + "</td>";
    return "<td>" + esc(v) + "</td>";
  }

  function render(p) {
    const from = p.total === 0 ? 0 : p.offset + 1;
    const to = Math.min(p.offset + p.pageSize, p.offset + p.rows.length);
    $("info").textContent = p.rows.length + " rows shown · " + from + "-" + to + " of " + p.total + " · " + p.durationMs + "ms";
    $("prev").disabled = p.offset <= 0;
    $("next").disabled = p.offset + p.pageSize >= p.total;
    if (!p.columns.length) { $("grid").className = "msg"; $("grid").textContent = "No columns."; return; }
    const head = "<tr>" + p.columns.map((c) => "<th>" + esc(c) + "</th>").join("") + "</tr>";
    const body = p.rows.map((row) => "<tr>" + p.columns.map((c) => renderCell(row[c])).join("") + "</tr>").join("");
    const wrap = $("grid"); wrap.className = ""; wrap.outerHTML = '<table id="grid"><thead>' + head + "</thead><tbody>" + body + "</tbody></table>";
  }

  $("prev").addEventListener("click", () => vscode.postMessage({ type: "prev" }));
  $("next").addEventListener("click", () => vscode.postMessage({ type: "next" }));

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (msg.type === "data") { render(msg.payload); }
    else if (msg.type === "error") {
      const g = $("grid"); g.className = "err"; g.textContent = msg.payload.message;
    }
  });

  vscode.postMessage({ type: "ready" });
</script>
</body>
</html>`;
  }

  private dispose(): void {
    TableDataPanel.panels.delete(this.key);
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }
}
