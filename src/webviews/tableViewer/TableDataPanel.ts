import * as vscode from "vscode";
import { EXTENSION_DISPLAY_NAME } from "../../core/constants";
import type { ConnectionProfile, ObjectRef } from "../../core/types";
import type { DataEditService } from "../../services/DataEditService";
import type { QueryService } from "../../services/QueryService";
import type { SchemaService } from "../../services/SchemaService";
import type { ColumnValue } from "../../utils/rowMutation";
import {
  isProduction,
  productionWriteWarning,
  type WriteAction
} from "../../utils/productionGuard";
import { buildCsp, getNonce } from "../WebviewBase";
import { commonStyles } from "../webviewStyles";

const DEFAULT_PAGE_SIZE = 100;

/** Dependency cho Object panel (data + properties + edit). */
export interface ObjectPanelDeps {
  queryService: QueryService;
  schemaService: SchemaService;
  dataEditService: DataEditService;
}

interface IncomingMessage {
  type:
    | "ready"
    | "loadData"
    | "loadProperties"
    | "updateRow"
    | "insertRow"
    | "deleteRow"
    | "previewAddColumn"
    | "previewDropColumn"
    | "applyDdl";
  offset?: number;
  pageSize?: number;
  keys?: ColumnValue[];
  set?: ColumnValue[];
  values?: ColumnValue[];
  column?: string;
  def?: { name: string; dataType: string; nullable: boolean; defaultValue?: string };
  sql?: string;
  action?: WriteAction;
}

/**
 * Object panel: một webview có tabs cho Data (xem + sửa), Columns, Constraints,
 * Triggers và DDL. Thay thế table viewer chỉ-đọc trước đây.
 */
export class TableDataPanel {
  private static readonly panels = new Map<string, TableDataPanel>();

  private readonly disposables: vscode.Disposable[] = [];
  private offset = 0;
  private pageSize = DEFAULT_PAGE_SIZE;

  static show(deps: ObjectPanelDeps, profile: ConnectionProfile, ref: ObjectRef): void {
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
    TableDataPanel.panels.set(key, new TableDataPanel(key, panel, deps, profile, ref));
  }

  private constructor(
    private readonly key: string,
    private readonly panel: vscode.WebviewPanel,
    private readonly deps: ObjectPanelDeps,
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
    try {
      switch (message.type) {
        case "ready":
        case "loadData":
          if (message.pageSize) {
            this.pageSize = message.pageSize;
          }
          this.offset = message.offset ?? this.offset;
          await this.loadData();
          break;
        case "loadProperties":
          await this.loadProperties();
          break;
        case "updateRow":
          await this.doWrite("update", () =>
            this.deps.dataEditService.updateRow(
              this.profile,
              this.ref,
              message.set ?? [],
              message.keys ?? []
            )
          );
          break;
        case "insertRow":
          await this.doWrite("insert", () =>
            this.deps.dataEditService.insertRow(this.profile, this.ref, message.values ?? [])
          );
          break;
        case "deleteRow":
          await this.doWrite("delete", () =>
            this.deps.dataEditService.deleteRow(this.profile, this.ref, message.keys ?? [])
          );
          break;
        case "previewAddColumn":
          if (message.def) {
            const sql = await this.deps.dataEditService.previewAddColumn(
              this.profile,
              this.ref,
              message.def
            );
            this.post({ type: "ddlPreview", payload: { sql, action: "addColumn" } });
          }
          break;
        case "previewDropColumn":
          if (message.column) {
            const sql = await this.deps.dataEditService.previewDropColumn(
              this.profile,
              this.ref,
              message.column
            );
            this.post({ type: "ddlPreview", payload: { sql, action: "dropColumn" } });
          }
          break;
        case "applyDdl":
          if (message.sql) {
            const sql = message.sql;
            await this.doWrite("ddl", () => this.deps.dataEditService.runDdl(this.profile, sql), {
              reloadProperties: true
            });
          }
          break;
      }
    } catch (error) {
      this.post({ type: "error", payload: { message: toMessage(error) } });
    }
  }

  /** Chạy một thao tác ghi với production guard (confirm modal nếu production). */
  private async doWrite(
    action: WriteAction,
    run: () => Promise<{ affectedRows?: number }>,
    options: { reloadProperties?: boolean } = {}
  ): Promise<void> {
    const warning = productionWriteWarning(this.profile, action);
    if (warning) {
      const choice = await vscode.window.showWarningMessage(warning, { modal: true }, "Run anyway");
      if (choice !== "Run anyway") {
        this.post({ type: "writeResult", payload: { ok: false, message: "Cancelled." } });
        return;
      }
    }
    const result = await run();
    this.post({
      type: "writeResult",
      payload: { ok: true, message: `Done. ${result.affectedRows ?? 0} row(s) affected.` }
    });
    if (options.reloadProperties) {
      await this.loadProperties();
    }
    await this.loadData();
  }

  private async loadData(): Promise<void> {
    const [page, columns] = await Promise.all([
      this.deps.queryService.getTablePage(this.profile, this.ref, this.pageSize, this.offset),
      this.deps.schemaService.listColumns(this.profile, this.ref).catch(() => [])
    ]);
    const pkColumns = columns.filter((column) => column.isPrimaryKey).map((column) => column.name);
    this.post({
      type: "data",
      payload: {
        columns: page.result.columns.map((column) => column.name),
        pkColumns,
        rows: page.result.rows,
        total: page.total,
        offset: page.offset,
        pageSize: page.limit,
        durationMs: page.result.durationMs
      }
    });
  }

  private async loadProperties(): Promise<void> {
    const schema = this.deps.schemaService;
    const [columns, indexes, foreignKeys, triggers, checks, ddl] = await Promise.all([
      schema.listColumns(this.profile, this.ref).catch(() => []),
      schema.listIndexes(this.profile, this.ref).catch(() => []),
      schema.listForeignKeys(this.profile, this.ref).catch(() => []),
      schema.listTriggers(this.profile, this.ref).catch(() => []),
      schema.listCheckConstraints(this.profile, this.ref).catch(() => []),
      schema.getObjectDDL(this.profile, this.ref).catch(() => "")
    ]);
    this.post({
      type: "properties",
      payload: { columns, indexes, foreignKeys, triggers, checks, ddl }
    });
  }

  private post(message: unknown): void {
    void this.panel.webview.postMessage(message);
  }

  private buildHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const csp = buildCsp(webview.cspSource, nonce);
    const prodBanner = isProduction(this.profile)
      ? `<div class="banner prod">⚠ PRODUCTION connection — writes require confirmation.</div>`
      : "";
    const title = this.ref.schema ? `${this.ref.schema}.${this.ref.name}` : this.ref.name;
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
  <div class="tabs" id="tabs">
    <button class="tab active" data-tab="data">Data</button>
    <button class="tab" data-tab="columns">Columns</button>
    <button class="tab" data-tab="constraints">Constraints</button>
    <button class="tab" data-tab="triggers">Triggers</button>
    <button class="tab" data-tab="ddl">DDL</button>
  </div>
  ${prodBanner}

  <!-- DATA -->
  <section class="panel active" id="panel-data">
    <div class="toolbar">
      <span class="title">▦ ${esc(title)}</span>
      <button class="btn" id="prev">◀ Prev</button>
      <button class="btn" id="next">Next ▶</button>
      <select id="pageSize" title="Rows per page">
        <option value="50">50</option>
        <option value="100" selected>100</option>
        <option value="200">200</option>
        <option value="500">500</option>
      </select>
      <button class="btn" id="reloadData" title="Reload">⟳ Reload</button>
      <button class="btn primary" id="addRow">＋ Add row</button>
      <span class="spacer"></span>
      <span class="subtle" id="dataInfo"></span>
    </div>
    <div class="grid-wrap"><div id="dataGrid" class="msg">Loading…</div></div>
  </section>

  <!-- COLUMNS -->
  <section class="panel" id="panel-columns">
    <div class="section">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <h3 style="margin:0">Columns</h3>
        <span class="spacer"></span>
        <button class="btn primary" id="addColumn">＋ Add column</button>
      </div>
      <div id="columnsGrid" class="msg">Open this tab to load.</div>
      <div id="addColumnForm" style="display:none;margin-top:14px;padding:12px;border:1px solid var(--border);border-radius:6px">
        <h3>New column</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <input id="colName" placeholder="name" />
          <input id="colType" placeholder="type (e.g. text, int, varchar(255))" style="min-width:220px" />
          <label class="subtle"><input type="checkbox" id="colNullable" checked /> nullable</label>
          <input id="colDefault" placeholder="default (optional, raw SQL)" />
          <button class="btn" id="colPreview">Preview SQL</button>
        </div>
        <pre class="sql-box" id="ddlPreview" style="display:none;margin-top:10px"></pre>
        <div style="margin-top:10px;display:none" id="ddlActions">
          <button class="btn primary" id="ddlApply">Run DDL</button>
          <button class="btn" id="ddlCancel">Cancel</button>
        </div>
      </div>
    </div>
  </section>

  <!-- CONSTRAINTS -->
  <section class="panel" id="panel-constraints">
    <div class="section"><h3>Indexes</h3><div id="indexesGrid" class="subtle">—</div></div>
    <div class="section"><h3>Foreign keys</h3><div id="fkGrid" class="subtle">—</div></div>
    <div class="section"><h3>Check constraints</h3><div id="checksGrid" class="subtle">—</div></div>
  </section>

  <!-- TRIGGERS -->
  <section class="panel" id="panel-triggers">
    <div class="section"><h3>Triggers</h3><div id="triggersGrid" class="subtle">—</div></div>
  </section>

  <!-- DDL -->
  <section class="panel" id="panel-ddl">
    <div class="section">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <h3 style="margin:0">Definition</h3><span class="spacer"></span>
        <button class="btn" id="copyDdl">Copy</button>
      </div>
      <pre class="sql-box" id="ddlBox">—</pre>
    </div>
  </section>

  <div class="toast" id="toast"></div>

<script nonce="${nonce}">
${this.clientScript()}
</script>
</body>
</html>`;
  }

  private clientScript(): string {
    // Client-side controller. Giữ trong template string; không truy cập Node.
    return `
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function toast(text, isErr){ const t=$("toast"); t.textContent=text; t.className="toast show"+(isErr?" error":""); setTimeout(()=>{t.className="toast";}, 2600); }

  let state = { columns: [], pkColumns: [], rows: [], total: 0, offset: 0, pageSize: 100 };
  let propsLoaded = false;

  // Tabs
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t)=>t.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p)=>p.classList.remove("active"));
      tab.classList.add("active");
      $("panel-" + tab.dataset.tab).classList.add("active");
      if (tab.dataset.tab !== "data" && !propsLoaded) { vscode.postMessage({ type: "loadProperties" }); }
    });
  });

  // Data toolbar
  $("prev").addEventListener("click", () => { state.offset = Math.max(0, state.offset - state.pageSize); load(); });
  $("next").addEventListener("click", () => { state.offset += state.pageSize; load(); });
  $("reloadData").addEventListener("click", load);
  $("pageSize").addEventListener("change", () => { state.pageSize = Number($("pageSize").value); state.offset = 0; load(); });
  $("addRow").addEventListener("click", showAddRow);
  function load(){ vscode.postMessage({ type:"loadData", offset: state.offset, pageSize: state.pageSize }); }

  function cellHtml(col, v, rowIndex){
    const editable = state.pkColumns.length > 0;
    const cls = (state.pkColumns.includes(col) ? "pk " : "") + (editable ? "editable" : "");
    if (v === null || v === undefined) return '<td class="'+cls+' null" data-col="'+esc(col)+'" data-row="'+rowIndex+'">NULL</td>';
    const text = (typeof v === "object") ? JSON.stringify(v) : String(v);
    return '<td class="'+cls+'" data-col="'+esc(col)+'" data-row="'+rowIndex+'">'+esc(text)+'</td>';
  }

  function renderData(p){
    state = { columns: p.columns, pkColumns: p.pkColumns, rows: p.rows, total: p.total, offset: p.offset, pageSize: p.pageSize };
    const from = p.total === 0 ? 0 : p.offset + 1;
    const to = p.offset + p.rows.length;
    const editNote = p.pkColumns.length ? "double-click a cell to edit" : "no primary key — read only";
    $("dataInfo").textContent = from + "–" + to + " of " + p.total + " · " + p.durationMs + "ms · " + editNote;
    $("prev").disabled = p.offset <= 0;
    $("next").disabled = p.offset + p.pageSize >= p.total;
    if (!p.columns.length){ $("dataGrid").className="msg"; $("dataGrid").textContent="No columns."; return; }
    const editable = p.pkColumns.length > 0;
    const actionsHead = editable ? "<th style='width:34px'></th>" : "";
    const head = "<tr>" + actionsHead + p.columns.map((c)=>"<th>"+esc(c)+(p.pkColumns.includes(c)?" 🔑":"")+"</th>").join("") + "</tr>";
    const body = p.rows.map((row, i) => {
      const del = editable ? "<td><button class='icon-btn' data-del='"+i+"' title='Delete row'>🗑</button></td>" : "";
      return "<tr>" + del + p.columns.map((c)=>cellHtml(c, row[c], i)).join("") + "</tr>";
    }).join("");
    const wrap = $("dataGrid"); wrap.className=""; wrap.outerHTML = '<table id="dataGrid"><thead>'+head+'</thead><tbody>'+body+'</tbody></table>';
    bindGrid();
  }

  function bindGrid(){
    document.querySelectorAll("#dataGrid td.editable").forEach((td) => {
      td.addEventListener("dblclick", () => beginEdit(td));
    });
    document.querySelectorAll("#dataGrid [data-del]").forEach((btn) => {
      btn.addEventListener("click", () => deleteRow(Number(btn.dataset.del)));
    });
  }

  function rowKeys(rowIndex){
    const row = state.rows[rowIndex];
    return state.pkColumns.map((c)=>({ column: c, value: row[c] === undefined ? null : row[c] }));
  }

  function beginEdit(td){
    if (td.querySelector("input")) return;
    const col = td.dataset.col; const rowIndex = Number(td.dataset.row);
    const original = state.rows[rowIndex][col];
    const input = document.createElement("input");
    input.value = (original === null || original === undefined) ? "" : (typeof original === "object" ? JSON.stringify(original) : String(original));
    input.style.width = "100%";
    td.textContent = ""; td.appendChild(input); input.focus(); input.select();
    let done = false;
    const commit = () => {
      if (done) return; done = true;
      const raw = input.value;
      const newVal = raw === "" ? null : raw;
      const origStr = (original === null || original === undefined) ? null : String(original);
      if (String(newVal) === String(origStr)) { renderData(stateAsPayload()); return; }
      vscode.postMessage({ type:"updateRow", set:[{ column: col, value: newVal }], keys: rowKeys(rowIndex) });
    };
    input.addEventListener("keydown", (e)=>{ if(e.key==="Enter"){commit();} else if(e.key==="Escape"){done=true;renderData(stateAsPayload());} });
    input.addEventListener("blur", commit);
  }
  function stateAsPayload(){ return { columns: state.columns, pkColumns: state.pkColumns, rows: state.rows, total: state.total, offset: state.offset, pageSize: state.pageSize, durationMs: 0 }; }

  function deleteRow(rowIndex){ vscode.postMessage({ type:"deleteRow", keys: rowKeys(rowIndex) }); }

  function showAddRow(){
    if (!state.columns.length) return;
    const tbody = document.querySelector("#dataGrid tbody"); if(!tbody) return;
    const editable = state.pkColumns.length>0;
    const tr = document.createElement("tr");
    const lead = editable ? "<td><button class='icon-btn' id='saveNew' title='Save'>✔</button></td>" : "";
    tr.innerHTML = lead + state.columns.map((c)=>"<td><input data-newcol='"+esc(c)+"' placeholder='"+esc(c)+"' style='width:100%'/></td>").join("");
    tbody.insertBefore(tr, tbody.firstChild);
    const save = () => {
      const values = [];
      tr.querySelectorAll("[data-newcol]").forEach((el)=>{ if(el.value !== "") values.push({ column: el.dataset.newcol, value: el.value }); });
      if (!values.length){ toast("Enter at least one value", true); return; }
      vscode.postMessage({ type:"insertRow", values });
    };
    const saveBtn = tr.querySelector("#saveNew");
    if (saveBtn) saveBtn.addEventListener("click", save);
    tr.querySelectorAll("input").forEach((inp)=>inp.addEventListener("keydown",(e)=>{ if(e.key==="Enter") save(); }));
    const first = tr.querySelector("input"); if(first) first.focus();
  }

  // Properties rendering
  function table(headers, rows){
    if(!rows.length) return '<div class="subtle">None.</div>';
    const head = "<tr>"+headers.map((h)=>"<th>"+esc(h)+"</th>").join("")+"</tr>";
    const body = rows.map((r)=>"<tr>"+r.map((c)=>"<td>"+c+"</td>").join("")+"</tr>").join("");
    return "<table><thead>"+head+"</thead><tbody>"+body+"</tbody></table>";
  }
  function pill(text, kind){ return '<span class="pill '+(kind||"")+'">'+esc(text)+'</span>'; }

  function renderProps(p){
    propsLoaded = true;
    $("columnsGrid").innerHTML = table(["#","Name","Type","Nullable","Default","Key",""],
      p.columns.map((c)=>[ String(c.ordinal), esc(c.name), esc(c.dataType),
        c.nullable?pill("NULL","yes"):pill("NOT NULL","no"),
        c.defaultValue?esc(c.defaultValue):'<span class="null">—</span>',
        c.isPrimaryKey?pill("PK","pk"):"",
        "<button class='icon-btn' data-dropcol='"+esc(c.name)+"' title='Drop column'>🗑</button>" ]));
    document.querySelectorAll("[data-dropcol]").forEach((b)=>b.addEventListener("click",()=>vscode.postMessage({type:"previewDropColumn", column:b.dataset.dropcol})));

    $("indexesGrid").innerHTML = table(["Name","Unique","Columns"],
      p.indexes.map((i)=>[esc(i.name), i.unique?pill("UNIQUE","yes"):pill("—","no"), esc(i.columns.join(", "))]));
    $("fkGrid").innerHTML = table(["Name","Columns","References","On update","On delete"],
      p.foreignKeys.map((f)=>[esc(f.name), esc(f.source.columns.join(", ")),
        esc((f.target.schema?f.target.schema+".":"")+f.target.table+" ("+f.target.columns.join(", ")+")"),
        esc(f.onUpdate||"—"), esc(f.onDelete||"—")]));
    $("checksGrid").innerHTML = table(["Name","Expression"], p.checks.map((c)=>[esc(c.name), esc(c.expression)]));
    $("triggersGrid").innerHTML = table(["Name","Timing","Event","Statement"],
      p.triggers.map((t)=>[esc(t.name), esc(t.timing||"—"), esc(t.event||"—"),
        '<span class="subtle">'+esc((t.statement||"").slice(0,160))+'</span>']));
    $("ddlBox").textContent = p.ddl || "—";
  }

  // Add column form
  $("addColumn").addEventListener("click", ()=>{ const f=$("addColumnForm"); f.style.display = f.style.display==="none"?"block":"none"; });
  $("colPreview").addEventListener("click", ()=>{
    const def = { name: $("colName").value.trim(), dataType: $("colType").value.trim(), nullable: $("colNullable").checked, defaultValue: $("colDefault").value.trim()||undefined };
    if(!def.name||!def.dataType){ toast("Name and type are required", true); return; }
    vscode.postMessage({ type:"previewAddColumn", def });
  });
  let pendingDdl = null;
  $("ddlApply").addEventListener("click", ()=>{ if(pendingDdl) vscode.postMessage({ type:"applyDdl", sql: pendingDdl }); });
  $("ddlCancel").addEventListener("click", ()=>{ $("ddlPreview").style.display="none"; $("ddlActions").style.display="none"; pendingDdl=null; });
  $("copyDdl").addEventListener("click", ()=>{ navigator.clipboard && navigator.clipboard.writeText($("ddlBox").textContent||""); toast("DDL copied"); });

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (msg.type === "data") renderData(msg.payload);
    else if (msg.type === "properties") renderProps(msg.payload);
    else if (msg.type === "ddlPreview") {
      pendingDdl = msg.payload.sql;
      $("addColumnForm").style.display="block";
      $("ddlPreview").textContent = msg.payload.sql; $("ddlPreview").style.display="block"; $("ddlActions").style.display="block";
      // đảm bảo đang ở tab Columns để người dùng thấy preview
      document.querySelectorAll(".tab").forEach((t)=>t.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p)=>p.classList.remove("active"));
      document.querySelector('.tab[data-tab="columns"]').classList.add("active");
      $("panel-columns").classList.add("active");
    }
    else if (msg.type === "writeResult") { toast(msg.payload.message, !msg.payload.ok); if(msg.payload.ok){ $("ddlPreview").style.display="none"; $("ddlActions").style.display="none"; pendingDdl=null; } }
    else if (msg.type === "error") {
      const g=$("dataGrid"); if(g){ g.className="err"; g.textContent=msg.payload.message; }
      toast(msg.payload.message, true);
    }
  });

  vscode.postMessage({ type: "ready" });
`;
  }

  private dispose(): void {
    TableDataPanel.panels.delete(this.key);
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
