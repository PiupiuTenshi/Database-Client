/**
 * Bộ style dùng chung cho mọi webview (Open DB Nexus design kit). Bám sát biến
 * theme của VS Code để tự hòa hợp light/dark/high-contrast. Truyền `nonce` để
 * khớp Content-Security-Policy.
 */
export function commonStyles(nonce: string): string {
  return `<style nonce="${nonce}">
  :root {
    --gap: 10px;
    --radius: 6px;
    --border: var(--vscode-panel-border, rgba(128,128,128,0.35));
    --muted: var(--vscode-descriptionForeground);
  }
  * { box-sizing: border-box; }
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size, 13px);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    margin: 0; padding: 0;
  }

  /* Toolbar */
  .toolbar {
    display: flex; align-items: center; gap: var(--gap);
    padding: 8px 12px; border-bottom: 1px solid var(--border);
    position: sticky; top: 0; z-index: 5;
    background: var(--vscode-editor-background);
    flex-wrap: wrap;
  }
  .toolbar .spacer { flex: 1 1 auto; }
  .title { font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 8px; }
  .subtle { color: var(--muted); font-size: 12px; }

  /* Tabs */
  .tabs { display: flex; gap: 2px; padding: 0 8px; border-bottom: 1px solid var(--border);
    background: var(--vscode-editor-background); position: sticky; top: 0; z-index: 4; overflow-x: auto; }
  .tab {
    padding: 8px 14px; cursor: pointer; border: none; background: none;
    color: var(--muted); font-size: 12px; border-bottom: 2px solid transparent; white-space: nowrap;
  }
  .tab:hover { color: var(--vscode-foreground); }
  .tab.active { color: var(--vscode-foreground); border-bottom-color: var(--vscode-focusBorder, var(--vscode-button-background)); }
  .panel { display: none; }
  .panel.active { display: block; }

  /* Buttons */
  button.btn {
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);
    border: 1px solid transparent; padding: 4px 10px; border-radius: var(--radius);
    cursor: pointer; font-size: 12px; font-family: inherit;
  }
  button.btn:hover { background: var(--vscode-button-secondaryHoverBackground, var(--vscode-button-secondaryBackground)); }
  button.btn.primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  button.btn.primary:hover { background: var(--vscode-button-hoverBackground, var(--vscode-button-background)); }
  button.btn.danger { color: var(--vscode-errorForeground); }
  button.btn:disabled { opacity: 0.5; cursor: default; }
  button.icon-btn { background: none; border: none; color: var(--muted); cursor: pointer; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
  button.icon-btn:hover { background: var(--vscode-toolbar-hoverBackground, var(--vscode-list-hoverBackground)); color: var(--vscode-foreground); }

  input, select, textarea {
    background: var(--vscode-input-background); color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, var(--border)); border-radius: 4px;
    padding: 4px 6px; font-family: inherit; font-size: 12px;
  }
  input:focus, select:focus, textarea:focus { outline: 1px solid var(--vscode-focusBorder); }

  /* Data grid */
  .grid-wrap { overflow: auto; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { border: 1px solid var(--border); padding: 5px 9px; text-align: left; white-space: nowrap; vertical-align: top; }
  th { position: sticky; top: 0; background: var(--vscode-keybindingTable-headerBackground, var(--vscode-editorWidget-background)); font-weight: 600; z-index: 1; }
  tbody tr:nth-child(even) td { background: var(--vscode-list-hoverBackground); }
  tbody tr:hover td { background: var(--vscode-list-activeSelectionBackground, var(--vscode-list-hoverBackground)); }
  td.editable { cursor: text; }
  td.pk { font-weight: 600; }
  .null { color: var(--muted); font-style: italic; }
  .pill { display: inline-block; padding: 1px 7px; border-radius: 999px; font-size: 11px; border: 1px solid var(--border); color: var(--muted); }
  .pill.pk { color: var(--vscode-charts-yellow, #d7ba7d); border-color: currentColor; }
  .pill.yes { color: var(--vscode-charts-green, #89d185); }
  .pill.no { color: var(--muted); }

  .section { padding: 12px 16px; }
  .section h3 { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .msg { padding: 18px; color: var(--muted); }
  .err { padding: 14px 16px; color: var(--vscode-errorForeground); white-space: pre-wrap; }
  .sql-box {
    margin: 0; padding: 10px 12px; background: var(--vscode-textCodeBlock-background, var(--vscode-editorWidget-background));
    border: 1px solid var(--border); border-radius: var(--radius); font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px; white-space: pre-wrap; overflow-x: auto;
  }
  .banner { padding: 6px 12px; font-size: 12px; border-bottom: 1px solid var(--border); }
  .banner.prod { background: var(--vscode-inputValidation-warningBackground, rgba(255,180,0,0.15)); color: var(--vscode-inputValidation-warningForeground, var(--vscode-foreground)); }
  .toast { position: fixed; bottom: 14px; right: 14px; max-width: 60%; padding: 8px 12px; border-radius: var(--radius);
    background: var(--vscode-notifications-background, var(--vscode-editorWidget-background)); border: 1px solid var(--border);
    box-shadow: 0 2px 10px rgba(0,0,0,0.3); font-size: 12px; opacity: 0; transition: opacity 0.2s; z-index: 20; }
  .toast.show { opacity: 1; }
  .toast.error { border-color: var(--vscode-errorForeground); }
</style>`;
}
