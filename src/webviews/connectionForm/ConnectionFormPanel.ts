import * as vscode from "vscode";
import { DB_TYPE_OPTIONS, ENVIRONMENT_OPTIONS, EXTENSION_DISPLAY_NAME } from "../../core/constants";
import { getConnectionSavedMessage } from "../../core/messages";
import type { ConnectionDraft, ConnectionProfile } from "../../core/types";
import type { ConnectionService } from "../../services/ConnectionService";
import { buildCsp, getNonce } from "../WebviewBase";

interface IncomingMessage {
  type: "ready" | "submit" | "test" | "cancel";
  payload?: { draft: ConnectionDraft; password: string };
}

/** Webview form tạo/sửa connection. Mỗi lúc chỉ giữ một panel (reuse). */
export class ConnectionFormPanel {
  private static current: ConnectionFormPanel | undefined;

  private readonly disposables: vscode.Disposable[] = [];

  static show(
    connectionService: ConnectionService,
    extensionUri: vscode.Uri,
    profile?: ConnectionProfile
  ): void {
    if (ConnectionFormPanel.current) {
      ConnectionFormPanel.current.profile = profile;
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
      profile
    );
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly connectionService: ConnectionService,
    private readonly extensionUri: vscode.Uri,
    private profile: ConnectionProfile | undefined
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
        const result = this.connectionService.testConnection(message.payload.draft);
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
    const supportedDatabases = [
      "SQLite",
      "DuckDB",
      "PostgreSQL",
      "MySQL / MariaDB",
      "SQL Server",
      "MongoDB",
      "Oracle",
      "Cloudflare D1",
      "Turso",
      "Azure SQL",
      "CockroachDB",
      "ClickHouse",
      "Trino / Presto",
      "Redis"
    ];
    const databaseBadges = supportedDatabases
      .map((database) => `<span class="database-badge">${database}</span>`)
      .join("");
    const envOptions = ENVIRONMENT_OPTIONS.map(
      (env) => `<option value="${env}">${env}</option>`
    ).join("");
    const fileBasedMap = JSON.stringify(
      Object.fromEntries(DB_TYPE_OPTIONS.map((o) => [o.value, o.fileBased]))
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${EXTENSION_DISPLAY_NAME}</title>
<style nonce="${nonce}">
  * { box-sizing: border-box; }
  body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--vscode-editor-background) 82%, var(--vscode-sideBar-background) 18%), var(--vscode-editor-background) 210px);
    margin: 0;
    padding: 18px;
  }
  h2 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: 0.01em; }
  .connection-header {
    margin-bottom: 18px;
    padding-bottom: 16px;
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
  .supported-databases { display: flex; flex-wrap: wrap; gap: 6px; max-width: 860px; }
  .database-badge {
    padding: 3px 8px;
    border: 1px solid var(--vscode-widget-border, var(--vscode-input-border, transparent));
    border-radius: 999px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    background: color-mix(in srgb, var(--vscode-editorWidget-background) 76%, transparent);
  }
  .field { margin-bottom: 13px; display: flex; flex-direction: column; min-width: 0; }
  label { font-size: 12px; margin-bottom: 5px; color: var(--vscode-descriptionForeground); }
  input, select {
    background: var(--vscode-input-background); color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
    padding: 7px 9px;
    border-radius: 7px;
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
  .row { display: flex; gap: 14px; align-items: flex-start; }
  .row .field { flex: 1; }
  #serverFields,
  #fileField,
  .field:has(#tags) {
    max-width: 860px;
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
    .row { flex-direction: column; gap: 0; }
  }
</style>
</head>
<body>
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

  <div class="field">
    <label for="name">Name *</label>
    <input id="name" type="text" placeholder="My Database" />
  </div>

  <div class="row">
    <div class="field">
      <label for="dbType">Database Type</label>
      <select id="dbType">${dbOptions}</select>
    </div>
    <div class="field">
      <label for="environment">Environment</label>
      <select id="environment">${envOptions}</select>
    </div>
  </div>

  <div class="field" id="fileField">
    <label for="filePath">File Path *</label>
    <input id="filePath" type="text" placeholder="/path/to/database.sqlite" />
  </div>

  <div id="serverFields">
    <div class="row">
      <div class="field" style="flex: 3">
        <label for="host">Host *</label>
        <input id="host" type="text" placeholder="localhost" />
      </div>
      <div class="field" style="flex: 1">
        <label for="port">Port</label>
        <input id="port" type="number" placeholder="5432" />
      </div>
    </div>
    <div class="field">
      <label for="database">Database</label>
      <input id="database" type="text" placeholder="app_db" />
    </div>
    <div class="row">
      <div class="field">
        <label for="username">Username</label>
        <input id="username" type="text" placeholder="postgres" />
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input id="password" type="password" placeholder="••••••••" />
      </div>
    </div>
    <div class="field" style="flex-direction: row; align-items: center; gap: 8px">
      <input id="ssl" type="checkbox" style="width: auto" />
      <label for="ssl" style="margin: 0">Use SSL/TLS (allow self-signed)</label>
    </div>
  </div>

  <div class="field">
    <label for="tags">Tags (comma separated)</label>
    <input id="tags" type="text" placeholder="local, demo" />
  </div>

  <div id="result"></div>

  <div class="actions">
    <button id="save">Save</button>
    <button id="test" class="secondary">Test Connection</button>
    <button id="cancel" class="secondary">Cancel</button>
  </div>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const FILE_BASED = ${fileBasedMap};
  const $ = (id) => document.getElementById(id);

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
    const fileBased = FILE_BASED[$("dbType").value];
    $("fileField").classList.toggle("hidden", !fileBased);
    $("serverFields").classList.toggle("hidden", fileBased);
  }

  function showResult(ok, message) {
    const el = $("result");
    el.textContent = message;
    el.className = ok ? "ok" : "err";
  }

  $("dbType").addEventListener("change", toggleFields);
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
      }
      toggleFields();
    } else if (msg.type === "testResult") {
      showResult(msg.payload.ok, msg.payload.message);
    }
  });

  toggleFields();
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
