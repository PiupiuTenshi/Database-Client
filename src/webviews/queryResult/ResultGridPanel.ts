import * as vscode from "vscode";
import { EXTENSION_DISPLAY_NAME } from "../../core/constants";
import type { DbError, QueryResult } from "../../core/types";
import { buildExport, extensionFor, type ExportFormat } from "../../utils/exporters";
import { buildCsp, getNonce } from "../WebviewBase";
import { commonStyles } from "../webviewStyles";

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

/** Webview hiển thị kết quả query (dùng lại một panel duy nhất), có export. */
export class ResultGridPanel {
  private static instance: ResultGridPanel | undefined;

  private readonly disposables: vscode.Disposable[] = [];
  private ready = false;
  private pending: GridPayload | undefined;
  private lastResult: ResultPayload | undefined;

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
      (message: { type: string; format?: ExportFormat }) => {
        if (message.type === "ready") {
          this.ready = true;
          if (this.pending) {
            this.send(this.pending);
          }
        } else if (message.type === "export" && message.format) {
          void this.exportResult(message.format);
        }
      },
      undefined,
      this.disposables
    );
    this.panel.onDidDispose(() => this.dispose(), undefined, this.disposables);
  }

  private post(payload: GridPayload): void {
    this.pending = payload;
    if (payload.kind === "result") {
      this.lastResult = payload;
    }
    if (this.ready) {
      this.send(payload);
    }
  }

  private send(payload: GridPayload): void {
    void this.panel.webview.postMessage(payload);
  }

  private async exportResult(format: ExportFormat): Promise<void> {
    const result = this.lastResult;
    if (!result || result.columns.length === 0) {
      void vscode.window.showInformationMessage("No query result to export.");
      return;
    }
    const content = buildExport(
      format,
      { name: "query_result" },
      result.columns,
      result.rows,
      (id) => `"${id.replace(/"/g, '""')}"`
    );
    const target = await vscode.window.showSaveDialog({
      filters: { [format.toUpperCase()]: [extensionFor(format)] },
      saveLabel: "Export",
      defaultUri: vscode.Uri.file(`query_result.${extensionFor(format)}`)
    });
    if (!target) {
      return;
    }
    await vscode.workspace.fs.writeFile(target, Buffer.from(content, "utf8"));
    void vscode.window.showInformationMessage(`Exported ${result.rows.length} row(s).`);
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
${commonStyles(nonce)}
</head>
<body>
  <div class="toolbar">
    <span class="title" id="bar">Run a query to see results.</span>
    <span class="spacer"></span>
    <input id="filter" placeholder="Filter rows…" style="min-width:160px" />
    <select id="exportFmt" title="Export format">
      <option value="csv">CSV</option>
      <option value="json">JSON</option>
      <option value="sql">SQL Insert</option>
    </select>
    <button class="btn" id="exportBtn">⭳ Export</button>
  </div>
  <div class="grid-wrap"><div id="grid" class="msg"></div></div>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function cell(v){
    if (v === null || v === undefined) return '<td class="null">NULL</td>';
    if (typeof v === "object") return "<td>" + esc(JSON.stringify(v)) + "</td>";
    return "<td>" + esc(v) + "</td>";
  }
  $("exportBtn").addEventListener("click", () => vscode.postMessage({ type:"export", format: $("exportFmt").value }));

  let current = null;        // last result payload
  let sortCol = null, sortDir = 1, filterText = "";

  function valStr(v){ return (v === null || v === undefined) ? "" : (typeof v === "object" ? JSON.stringify(v) : String(v)); }

  function viewRows(){
    let rows = current.rows;
    if (filterText){ const f = filterText.toLowerCase(); rows = rows.filter((r)=>current.columns.some((c)=>valStr(r[c]).toLowerCase().includes(f))); }
    if (sortCol !== null){
      rows = rows.slice().sort((a,b)=>{ const x=valStr(a[sortCol]), y=valStr(b[sortCol]);
        const nx=parseFloat(x), ny=parseFloat(y);
        const cmp = (!isNaN(nx)&&!isNaN(ny)) ? (nx-ny) : x.localeCompare(y);
        return cmp*sortDir; });
    }
    return rows;
  }

  function renderGrid(){
    if (!current) return;
    const rows = viewRows();
    $("bar").textContent = rows.length + (rows.length!==current.rowCount ? "/"+current.rowCount : "") + " rows · " + current.durationMs + "ms" + (current.truncated ? " · truncated" : "");
    const head = "<tr>" + current.columns.map((c)=>{ const arrow = sortCol===c ? (sortDir>0?" ▲":" ▼") : ""; return "<th data-col=\\""+esc(c)+"\\" style=\\"cursor:pointer\\">"+esc(c)+arrow+"</th>"; }).join("") + "</tr>";
    const body = rows.map((r)=>"<tr>"+current.columns.map((c)=>cell(r[c])).join("")+"</tr>").join("");
    $("grid").outerHTML = '<table id="grid"><thead>'+head+"</thead><tbody>"+body+"</tbody></table>";
    document.querySelectorAll("#grid th[data-col]").forEach((th)=>th.addEventListener("click", ()=>{
      const c = th.dataset.col;
      if (sortCol === c) sortDir = -sortDir; else { sortCol = c; sortDir = 1; }
      renderGrid();
    }));
  }

  $("filter").addEventListener("input", () => { filterText = $("filter").value; if (current) renderGrid(); });

  window.addEventListener("message", (event) => {
    const p = event.data;
    if (p.kind === "error") {
      current = null;
      $("bar").textContent = "Error" + (p.code ? " [" + p.code + "]" : "");
      $("grid").outerHTML = '<div id="grid" class="err">' + esc(p.message) + "</div>";
      return;
    }
    if (!p.columns.length) {
      current = null;
      $("bar").textContent = (p.affectedRows ?? 0) + " row(s) affected · " + p.durationMs + "ms";
      $("grid").outerHTML = '<div id="grid" class="msg">Query OK.</div>';
      return;
    }
    current = p; sortCol = null; sortDir = 1;
    renderGrid();
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
