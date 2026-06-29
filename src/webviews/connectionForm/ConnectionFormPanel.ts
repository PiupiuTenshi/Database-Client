import * as vscode from "vscode";
import {
  DB_TYPE_OPTIONS,
  DEFAULT_DB_PORTS,
  ENVIRONMENT_OPTIONS,
  EXTENSION_DISPLAY_NAME
} from "../../core/constants";
import { getConnectionSavedMessage } from "../../core/messages";
import type { ConnectionDraft, ConnectionProfile } from "../../core/types";
import type { ConnectionService } from "../../services/ConnectionService";
import { buildCsp, getNonce } from "../WebviewBase";

interface IncomingMessage {
  type: "ready" | "submit" | "test" | "cancel";
  payload?: { draft: ConnectionDraft; password: string };
}

type DraftTester = (
  draft: ConnectionDraft,
  password?: string
) => Promise<{ ok: boolean; message: string }>;

/** Webview form tạo/sửa connection. Mỗi lúc chỉ giữ một panel (reuse). */
export class ConnectionFormPanel {
  private static current: ConnectionFormPanel | undefined;

  private readonly disposables: vscode.Disposable[] = [];

  static show(
    connectionService: ConnectionService,
    extensionUri: vscode.Uri,
    profile?: ConnectionProfile,
    draftTester?: DraftTester
  ): void {
    if (ConnectionFormPanel.current) {
      ConnectionFormPanel.current.profile = profile;
      ConnectionFormPanel.current.draftTester = draftTester;
      ConnectionFormPanel.current.panel.title = ConnectionFormPanel.titleFor(profile);
      ConnectionFormPanel.current.panel.reveal(vscode.ViewColumn.Active);
      ConnectionFormPanel.current.render();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "openDbNexus.connectionForm",
      ConnectionFormPanel.titleFor(profile),
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "resources")]
      }
    );
    ConnectionFormPanel.current = new ConnectionFormPanel(
      panel,
      connectionService,
      extensionUri,
      profile,
      draftTester
    );
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly connectionService: ConnectionService,
    private readonly extensionUri: vscode.Uri,
    private profile: ConnectionProfile | undefined,
    private draftTester: DraftTester | undefined
  ) {
    this.render();
    this.panel.webview.onDidReceiveMessage(
      (message: IncomingMessage) => void this.handleMessage(message),
      undefined,
      this.disposables
    );
    this.panel.onDidDispose(() => this.dispose(), undefined, this.disposables);
  }

  private static titleFor(profile?: ConnectionProfile): string {
    return profile ? `Edit: ${profile.name}` : "New Connection";
  }

  private async handleMessage(message: IncomingMessage): Promise<void> {
    switch (message.type) {
      case "ready":
        this.postInit();
        return;
      case "test": {
        if (!message.payload) {
          return;
        }
        const validation = this.connectionService.testConnection(message.payload.draft);
        const result =
          validation.ok && this.draftTester
            ? await this.draftTester(
                message.payload.draft,
                message.payload.password.length > 0 ? message.payload.password : undefined
              )
            : validation;
        void this.panel.webview.postMessage({ type: "testResult", payload: result });
        return;
      }
      case "submit": {
        if (!message.payload) {
          return;
        }
        const { draft, password } = message.payload;
        const pwd = password.length > 0 ? password : undefined;
        const saved = this.profile
          ? await this.connectionService.updateProfile(this.profile.id, draft, pwd)
          : await this.connectionService.createProfile(draft, pwd);
        if (saved) {
          void vscode.window.showInformationMessage(getConnectionSavedMessage(saved.name));
          this.panel.dispose();
        }
        return;
      }
      case "cancel":
        this.panel.dispose();
        return;
    }
  }

  private postInit(): void {
    void this.panel.webview.postMessage({
      type: "init",
      payload: {
        isEdit: Boolean(this.profile),
        // Không gửi password ra webview. Chỉ báo có hay không.
        hasPassword: false,
        profile: this.profile
      }
    });
  }

  private render(): void {
    this.panel.webview.html = this.buildHtml(this.panel.webview);
  }

  private buildHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const csp = buildCsp(webview.cspSource, nonce);
    const logoUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "resources", "db-nexus-logo.svg")
    );
    const dbOptions = DB_TYPE_OPTIONS.map(
      (option) => `<option value="${option.value}">${option.label}</option>`
    ).join("");
    const dbVisuals: Record<string, { short: string; tone: string }> = {
      sqlite: { short: "SL", tone: "teal" },
      duckdb: { short: "DK", tone: "amber" },
      postgresql: { short: "PG", tone: "blue" },
      mysql: { short: "MY", tone: "cyan" },
      mariadb: { short: "MA", tone: "cyan" },
      sqlserver: { short: "MS", tone: "violet" },
      mongodb: { short: "MO", tone: "green" },
      redis: { short: "RD", tone: "red" },
      oracle: { short: "OR", tone: "red" },
      "cloudflare-d1": { short: "D1", tone: "amber" },
      turso: { short: "TU", tone: "green" },
      azuresql: { short: "AZ", tone: "blue" },
      cockroachdb: { short: "CR", tone: "amber" },
      gaussdb: { short: "GS", tone: "violet" },
      kingbase: { short: "KB", tone: "red" },
      redshift: { short: "RS", tone: "red" },
      doris: { short: "DO", tone: "cyan" },
      clickhouse: { short: "CH", tone: "amber" },
      trino: { short: "TR", tone: "violet" },
      presto: { short: "PR", tone: "violet" }
    };
    const databaseBadges = DB_TYPE_OPTIONS.map((option) => {
      const visual = dbVisuals[option.value] ?? { short: option.label.slice(0, 2), tone: "blue" };
      return `<button type="button" class="database-badge ${visual.tone}" data-db="${option.value}" title="${option.label}">
        <span class="db-mark">${visual.short}</span><span>${option.label}</span>
      </button>`;
    })
      .join("");
    const envOptions = ENVIRONMENT_OPTIONS.map(
      (env) => `<option value="${env}">${env}</option>`
    ).join("");
    const fileBasedMap = JSON.stringify(
      Object.fromEntries(DB_TYPE_OPTIONS.map((o) => [o.value, o.fileBased]))
    );
    const defaultPorts = JSON.stringify(DEFAULT_DB_PORTS);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${EXTENSION_DISPLAY_NAME}</title>
<style nonce="${nonce}">
  * { box-sizing: border-box; }
  :root {
    --accent-blue: #4ea1ff;
    --accent-cyan: #34d3c5;
    --accent-green: #72d572;
    --accent-amber: #e8b84e;
    --accent-red: #ff6b6b;
    --accent-violet: #b58cff;
    --surface-1: color-mix(in srgb, var(--vscode-editorWidget-background) 86%, transparent);
    --surface-2: color-mix(in srgb, var(--vscode-sideBar-background) 76%, var(--vscode-editor-background));
  }
  body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--vscode-editor-background) 82%, var(--vscode-sideBar-background) 18%), var(--vscode-editor-background) 210px);
    margin: 0;
    padding: 20px;
  }
  h2 { margin: 0; font-size: 19px; font-weight: 700; letter-spacing: 0; }
  .shell { max-width: 980px; }
  .connection-header {
    margin-bottom: 16px;
    padding: 14px 0 16px;
    border-bottom: 1px solid var(--vscode-panel-border);
  }
  .brand { display: flex; align-items: center; gap: 12px; margin: 12px 0 14px; }
  .brand-logo {
    width: 42px;
    height: 42px;
    flex: 0 0 auto;
    padding: 5px;
    border: 1px solid var(--vscode-panel-border);
    border-radius: 8px;
    background: var(--vscode-editorWidget-background);
  }
  .brand-name { font-size: 14px; font-weight: 700; }
  .brand-description { margin-top: 3px; font-size: 12px; color: var(--vscode-descriptionForeground); }
  .supported-databases { display: flex; flex-wrap: wrap; gap: 7px; max-width: 960px; }
  .database-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px 4px 5px;
    border: 1px solid var(--vscode-widget-border, var(--vscode-input-border, transparent));
    border-radius: 8px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    background: color-mix(in srgb, var(--vscode-editorWidget-background) 76%, transparent);
    min-height: 27px;
  }
  .database-badge:hover {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, currentColor 45%, var(--vscode-panel-border));
  }
  .database-badge.active {
    color: var(--vscode-foreground);
    border-color: var(--badge-color);
    background: color-mix(in srgb, var(--badge-color) 17%, var(--surface-1));
  }
  .database-badge.blue { --badge-color: var(--accent-blue); }
  .database-badge.cyan { --badge-color: var(--accent-cyan); }
  .database-badge.green { --badge-color: var(--accent-green); }
  .database-badge.amber { --badge-color: var(--accent-amber); }
  .database-badge.red { --badge-color: var(--accent-red); }
  .database-badge.violet { --badge-color: var(--accent-violet); }
  .db-mark {
    display: inline-grid;
    place-items: center;
    width: 21px;
    height: 19px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 700;
    color: color-mix(in srgb, var(--badge-color) 88%, white);
    background: color-mix(in srgb, var(--badge-color) 20%, transparent);
  }
  .form-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(300px, 0.9fr);
    gap: 16px;
    align-items: start;
  }
  .section {
    border: 1px solid var(--vscode-panel-border);
    background: var(--surface-1);
    border-radius: 8px;
    padding: 14px;
  }
  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 12px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--vscode-descriptionForeground);
  }
  .section-title svg,
  .label-row svg,
  button svg {
    width: 15px;
    height: 15px;
    stroke: currentColor;
    stroke-width: 2;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .field { margin-bottom: 13px; display: flex; flex-direction: column; min-width: 0; }
  label { font-size: 12px; margin-bottom: 5px; color: var(--vscode-descriptionForeground); }
  .label-row {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  input, select {
    background: var(--vscode-input-background); color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
    padding: 7px 9px;
    border-radius: 8px;
    font-size: 13px;
    min-height: 32px;
    transition: border-color 120ms ease, box-shadow 120ms ease, background 120ms ease;
  }
  input:hover, select:hover {
    border-color: var(--vscode-focusBorder, var(--vscode-input-border));
  }
  input:focus, select:focus {
    outline: none;
    border-color: var(--vscode-focusBorder);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--vscode-focusBorder) 24%, transparent);
  }
  input::placeholder { color: color-mix(in srgb, var(--vscode-input-foreground) 42%, transparent); }
  .row { display: flex; gap: 12px; align-items: flex-start; }
  .row .field { flex: 1; }
  .port-line {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .port-line input { flex: 1; }
  .icon-btn {
    display: inline-grid;
    place-items: center;
    width: 32px;
    min-width: 32px;
    padding: 0;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border-color: var(--vscode-widget-border, transparent);
  }
  .hint {
    margin-top: 5px;
    color: var(--vscode-descriptionForeground);
    font-size: 11px;
  }
  .selected-db {
    margin-top: 8px;
    padding: 10px;
    border-radius: 8px;
    background: var(--surface-2);
    border: 1px solid var(--vscode-panel-border);
  }
  .selected-db-main {
    display: flex;
    align-items: center;
    gap: 9px;
    font-weight: 700;
  }
  .selected-db-main .db-mark {
    width: 28px;
    height: 25px;
  }
  .selected-db-meta {
    margin-top: 7px;
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 20px;
    padding-top: 14px;
    border-top: 1px solid var(--vscode-panel-border);
    flex-wrap: wrap;
  }
  button {
    background: var(--vscode-button-background); color: var(--vscode-button-foreground);
    border: 1px solid transparent;
    padding: 7px 14px;
    border-radius: 7px;
    cursor: pointer;
    font-size: 13px;
    min-height: 32px;
    transition: transform 120ms ease, background 120ms ease, border-color 120ms ease;
  }
  button:hover { background: var(--vscode-button-hoverBackground); transform: translateY(-1px); }
  button:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 2px; }
  button.secondary {
    background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);
  }
  button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground, var(--vscode-button-secondaryBackground)); }
  button.icon-label {
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }
  #result {
    margin-top: 14px;
    padding: 10px 12px;
    border-radius: 7px;
    font-size: 12px;
    display: none;
    max-width: 860px;
  }
  #result.ok { display: block; background: var(--vscode-inputValidation-infoBackground); border: 1px solid var(--vscode-inputValidation-infoBorder); }
  #result.err { display: block; background: var(--vscode-inputValidation-errorBackground); border: 1px solid var(--vscode-inputValidation-errorBorder); }
  .hidden { display: none !important; }
  @media (max-width: 640px) {
    body { padding: 14px; }
    .form-grid { grid-template-columns: 1fr; }
    .row { flex-direction: column; gap: 0; }
  }
</style>
</head>
<body>
  <div class="shell">
    <header class="connection-header">
      <h2 id="heading">New Connection</h2>
      <div class="brand">
        <img class="brand-logo" src="${logoUri.toString()}" alt="Open DB Nexus logo" />
        <div>
          <div class="brand-name">${EXTENSION_DISPLAY_NAME}</div>
          <div class="brand-description">Connect to your databases from VS Code</div>
        </div>
      </div>
      <div class="supported-databases" aria-label="Supported databases">${databaseBadges}</div>
    </header>

    <div class="form-grid">
      <section class="section">
        <div class="section-title">${icon("database")}Connection</div>
        <div class="field">
          <label class="label-row" for="name">${icon("tag")}Name *</label>
          <input id="name" type="text" placeholder="My Database" />
        </div>

        <div class="row">
          <div class="field">
            <label class="label-row" for="dbType">${icon("layers")}Database Type</label>
            <select id="dbType">${dbOptions}</select>
            <div id="selectedDb" class="selected-db"></div>
          </div>
          <div class="field">
            <label class="label-row" for="environment">${icon("shield")}Environment</label>
            <select id="environment">${envOptions}</select>
          </div>
        </div>

        <div class="field">
          <label class="label-row" for="tags">${icon("hash")}Tags</label>
          <input id="tags" type="text" placeholder="local, demo" />
        </div>
      </section>

      <section class="section">
        <div class="section-title">${icon("plug")}Endpoint</div>
        <div class="field" id="fileField">
          <label class="label-row" for="filePath">${icon("file")}File Path *</label>
          <input id="filePath" type="text" placeholder="/path/to/database.sqlite" />
        </div>

        <div id="serverFields">
          <div class="row">
            <div class="field" style="flex: 3">
              <label class="label-row" for="host">${icon("server")}Host *</label>
              <input id="host" type="text" placeholder="localhost" />
            </div>
            <div class="field" style="flex: 1.2">
              <label class="label-row" for="port">${icon("port")}Port</label>
              <div class="port-line">
                <input id="port" type="number" placeholder="5432" />
                <button id="defaultPort" class="icon-btn" type="button" title="Use default port">${icon("rotate")}</button>
              </div>
              <div id="portHint" class="hint"></div>
            </div>
          </div>
          <div class="field">
            <label class="label-row" for="database">${icon("database")}Database</label>
            <input id="database" type="text" placeholder="app_db" />
          </div>
          <div class="row">
            <div class="field">
              <label class="label-row" for="username">${icon("user")}Username</label>
              <input id="username" type="text" placeholder="postgres" />
            </div>
            <div class="field">
              <label class="label-row" for="password">${icon("key")}Password</label>
              <input id="password" type="password" placeholder="Password" />
            </div>
          </div>
          <div class="field" style="flex-direction: row; align-items: center; gap: 8px">
            <input id="ssl" type="checkbox" style="width: auto" />
            <label for="ssl" style="margin: 0">Use SSL/TLS</label>
          </div>
        </div>
      </section>
    </div>

    <div id="result"></div>

    <div class="actions">
      <button id="save" class="icon-label">${icon("save")}Save</button>
      <button id="test" class="secondary icon-label">${icon("zap")}Test Connection</button>
      <button id="cancel" class="secondary icon-label">${icon("x")}Cancel</button>
    </div>
  </div>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const FILE_BASED = ${fileBasedMap};
  const DEFAULT_PORTS = ${defaultPorts};
  const DB_OPTIONS = ${JSON.stringify(
    DB_TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))
  )};
  const DB_VISUALS = ${JSON.stringify(dbVisuals)};
  const $ = (id) => document.getElementById(id);
  let previousDbType = $("dbType").value;
  let portTouched = false;

  function dbLabel(dbType) {
    return DB_OPTIONS.find((option) => option.value === dbType)?.label ?? dbType;
  }

  function dbVisual(dbType) {
    return DB_VISUALS[dbType] ?? { short: dbLabel(dbType).slice(0, 2), tone: "blue" };
  }

  function collectDraft() {
    return {
      name: $("name").value,
      dbType: $("dbType").value,
      environment: $("environment").value,
      host: $("host").value,
      port: $("port").value ? Number($("port").value) : undefined,
      database: $("database").value,
      username: $("username").value,
      filePath: $("filePath").value,
      ssl: $("ssl").checked,
      tags: $("tags").value.split(",").map((t) => t.trim()).filter(Boolean)
    };
  }

  function toggleFields() {
    const dbType = $("dbType").value;
    const fileBased = FILE_BASED[dbType];
    $("fileField").classList.toggle("hidden", !fileBased);
    $("serverFields").classList.toggle("hidden", fileBased);
    updateSelectedDb();
    updateDbBadges();
    applyDefaultPort(false);
    previousDbType = dbType;
  }

  function applyDefaultPort(force) {
    const dbType = $("dbType").value;
    const nextDefault = DEFAULT_PORTS[dbType];
    const previousDefault = DEFAULT_PORTS[previousDbType];
    $("portHint").textContent = nextDefault ? "Default port: " + nextDefault + " (editable)" : "";
    if (!nextDefault || FILE_BASED[dbType]) return;
    const current = $("port").value;
    if (force || !portTouched || !current || Number(current) === previousDefault) {
      $("port").value = String(nextDefault);
      portTouched = false;
    }
  }

  function updateSelectedDb() {
    const dbType = $("dbType").value;
    const visual = dbVisual(dbType);
    const port = DEFAULT_PORTS[dbType];
    const typeText = FILE_BASED[dbType] ? "File-based database" : "Network database";
    $("selectedDb").className = "selected-db database-badge " + visual.tone + " active";
    $("selectedDb").innerHTML =
      '<div class="selected-db-main"><span class="db-mark">' + visual.short + '</span><span>' + dbLabel(dbType) + '</span></div>' +
      '<div class="selected-db-meta">' + typeText + (port ? " · default port " + port : "") + '</div>';
  }

  function updateDbBadges() {
    document.querySelectorAll("[data-db]").forEach((badge) => {
      badge.classList.toggle("active", badge.dataset.db === $("dbType").value);
    });
  }

  function showResult(ok, message) {
    const el = $("result");
    el.textContent = message;
    el.className = ok ? "ok" : "err";
  }

  $("dbType").addEventListener("change", toggleFields);
  $("port").addEventListener("input", () => { portTouched = true; });
  $("defaultPort").addEventListener("click", () => applyDefaultPort(true));
  document.querySelectorAll("[data-db]").forEach((badge) => {
    badge.addEventListener("click", () => {
      $("dbType").value = badge.dataset.db;
      toggleFields();
    });
  });
  $("save").addEventListener("click", () =>
    vscode.postMessage({ type: "submit", payload: { draft: collectDraft(), password: $("password").value } })
  );
  $("test").addEventListener("click", () =>
    vscode.postMessage({ type: "test", payload: { draft: collectDraft(), password: $("password").value } })
  );
  $("cancel").addEventListener("click", () => vscode.postMessage({ type: "cancel" }));

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (msg.type === "init") {
      const p = msg.payload.profile;
      $("heading").textContent = msg.payload.isEdit ? "Edit Connection" : "New Connection";
      if (p) {
        $("name").value = p.name ?? "";
        $("dbType").value = p.dbType ?? "sqlite";
        $("environment").value = p.environment ?? "local";
        $("host").value = p.host ?? "";
        $("port").value = p.port ?? "";
        $("database").value = p.database ?? "";
        $("username").value = p.username ?? "";
        $("filePath").value = p.filePath ?? "";
        $("ssl").checked = Boolean(p.ssl);
        $("tags").value = (p.tags ?? []).join(", ");
        $("password").placeholder = "Leave blank to keep existing";
        portTouched = Boolean(p.port);
      }
      toggleFields();
    } else if (msg.type === "testResult") {
      showResult(msg.payload.ok, msg.payload.message);
    }
  });

  toggleFields();
  applyDefaultPort(false);
  vscode.postMessage({ type: "ready" });
</script>
</body>
</html>`;
  }

  private dispose(): void {
    ConnectionFormPanel.current = undefined;
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }
}

function icon(name: string): string {
  const paths: Record<string, string> = {
    database:
      '<ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5"/><path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
    tag: '<path d="M20 10 14 4H5v9l6 6 9-9Z"/><path d="M8 8h.01"/>',
    layers:
      '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
    hash: '<path d="M4 9h16"/><path d="M4 15h16"/><path d="M10 3 8 21"/><path d="m16 3-2 18"/>',
    plug: '<path d="M8 2v6"/><path d="M16 2v6"/><path d="M7 8h10v5a5 5 0 0 1-10 0V8Z"/><path d="M12 18v4"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/>',
    server:
      '<rect x="4" y="4" width="16" height="6" rx="2"/><rect x="4" y="14" width="16" height="6" rx="2"/><path d="M8 7h.01"/><path d="M8 17h.01"/>',
    port: '<path d="M6 4h12"/><path d="M8 4v6l4 3 4-3V4"/><path d="M12 13v7"/>',
    rotate:
      '<path d="M21 12a9 9 0 0 1-15.3 6.4"/><path d="M3 12A9 9 0 0 1 18.3 5.6"/><path d="M3 18h6v-6"/><path d="M21 6h-6v6"/>',
    user: '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>',
    key: '<circle cx="7.5" cy="15.5" r="3.5"/><path d="M10 13 21 2"/><path d="m16 7 3 3"/><path d="m14 9 3 3"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
    zap: '<path d="M13 2 3 14h8l-1 8 11-14h-8l0-6Z"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] ?? paths.database}</svg>`;
}
