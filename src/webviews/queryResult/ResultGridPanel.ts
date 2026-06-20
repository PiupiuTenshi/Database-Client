import * as vscode from "vscode";
import { EXTENSION_DISPLAY_NAME } from "../../core/constants";
import type { DbError, QueryResult } from "../../core/types";
import { buildCsp, getNonce } from "../WebviewBase";

interface ResultPayload {
  kind: "result";
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
  truncated: boolean;
  affectedRows?: number;
}

interface ErrorPayload {
  kind: "error";
  message: string;
  code?: string;
}

type GridPayload = ResultPayload | ErrorPayload;

/** Webview hiển thị kết quả query (dùng lại một panel duy nhất). */
export class ResultGridPanel {
  private static instance: ResultGridPanel | undefined;

  private readonly disposables: vscode.Disposable[] = [];
  private ready = false;
  private pending: GridPayload | undefined;

  static showResult(result: QueryResult): void {
    const payload: ResultPayload = {
      kind: "result",
      columns: result.columns.map((column) => column.name),
      rows: result.rows,
      rowCount: result.rowCount,
      durationMs: result.durationMs,
      truncated: result.truncated ?? false,
      affectedRows: result.affectedRows
    };
    ResultGridPanel.ensure().post(payload);
  }

  static showError(error: DbError, durationMs: number): void {
    ResultGridPanel.ensure().post({
      kind: "error",
      message: `${error.message}${durationMs ? ` (${durationMs}ms)` : ""}`,
      code: error.code
    });
  }

  private static ensure(): ResultGridPanel {
    if (ResultGridPanel.instance) {
      ResultGridPanel.instance.panel.reveal(vscode.ViewColumn.Beside, true);
      return ResultGridPanel.instance;
    }
    const panel = vscode.window.createWebviewPanel(
      "openDbNexus.queryResult",
      "Query Result",
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: true, retainContextWhenHidden: true }
    );
    ResultGridPanel.instance = new ResultGridPanel(panel);
    return ResultGridPanel.instance;
  }

  private constructor(private readonly panel: vscode.WebviewPanel) {
    this.panel.webview.html = this.buildHtml(this.panel.webview);
    this.panel.webview.onDidReceiveMessage(
      (message: { type: string }) => {
        if (message.type === "ready") {
          this.ready = true;
          if (this.pending) {
            this.send(this.pending);
          }
        }
      },
      undefined,
      this.disposables
    );
    this.panel.onDidDispose(() => this.dispose(), undefined, this.disposables);
  }

  private post(payload: GridPayload): void {
    this.pending = payload;
    if (this.ready) {
      this.send(payload);
    }
  }

  private send(payload: GridPayload): void {
    void this.panel.webview.postMessage(payload);
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
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); margin: 0; }
  .bar { padding: 6px 12px; border-bottom: 1px solid var(--vscode-panel-border); font-size: 12px; position: sticky; top: 0; background: var(--vscode-editor-background); }
  .wrap { overflow: auto; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { border: 1px solid var(--vscode-panel-border); padding: 4px 8px; text-align: left; white-space: nowrap; }
  th { position: sticky; top: 0; background: var(--vscode-editorWidget-background); }
  tr:nth-child(even) td { background: var(--vscode-list-hoverBackground); }
  .null { color: var(--vscode-descriptionForeground); font-style: italic; }
  .msg { padding: 16px; color: var(--vscode-descriptionForeground); }
  .err { padding: 16px; color: var(--vscode-errorForeground); white-space: pre-wrap; }
</style>
</head>
<body>
  <div class="bar" id="bar">Run a query to see results.</div>
  <div class="wrap"><div id="grid"></div></div>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function cell(v){
    if (v === null || v === undefined) return '<td class="null">NULL</td>';
    if (typeof v === "object") return "<td>" + esc(JSON.stringify(v)) + "</td>";
    return "<td>" + esc(v) + "</td>";
  }
  window.addEventListener("message", (event) => {
    const p = event.data;
    if (p.kind === "error") {
      $("bar").textContent = "Error" + (p.code ? " [" + p.code + "]" : "");
      $("grid").outerHTML = '<div id="grid" class="err">' + esc(p.message) + "</div>";
      return;
    }
    if (!p.columns.length) {
      $("bar").textContent = (p.affectedRows ?? 0) + " row(s) affected · " + p.durationMs + "ms";
      $("grid").outerHTML = '<div id="grid" class="msg">Query OK.</div>';
      return;
    }
    $("bar").textContent = p.rowCount + " rows · " + p.durationMs + "ms" + (p.truncated ? " · truncated" : "");
    const head = "<tr>" + p.columns.map((c)=>"<th>"+esc(c)+"</th>").join("") + "</tr>";
    const body = p.rows.map((r)=>"<tr>"+p.columns.map((c)=>cell(r[c])).join("")+"</tr>").join("");
    $("grid").outerHTML = '<table id="grid"><thead>'+head+"</thead><tbody>"+body+"</tbody></table>";
  });
  vscode.postMessage({ type: "ready" });
</script>
</body>
</html>`;
  }

  private dispose(): void {
    ResultGridPanel.instance = undefined;
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }
}
