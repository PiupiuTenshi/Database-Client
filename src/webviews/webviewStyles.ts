/**
 * Bộ style dùng chung cho mọi webview (Open DB Nexus design kit). Bám sát biến
 * theme của VS Code để tự hòa hợp light/dark/high-contrast. Truyền `nonce` để
 * khớp Content-Security-Policy.
 */
export function commonStyles(nonce: string): string {
  return `<style nonce="${nonce}">
  :root {
    --gap: 10px;
    --radius: 7px;
    --border: var(--vscode-panel-border, rgba(128,128,128,0.35));
    --border-soft: color-mix(in srgb, var(--border) 72%, transparent);
    --muted: var(--vscode-descriptionForeground);
    --surface: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
    --surface-2: var(--vscode-sideBar-background, var(--vscode-editorWidget-background));
    --hover: var(--vscode-list-hoverBackground, rgba(127,127,127,0.12));
    --active: var(--vscode-list-activeSelectionBackground, var(--vscode-toolbar-hoverBackground));
    --shadow: 0 8px 24px rgba(0,0,0,0.18);
  }
  * { box-sizing: border-box; }
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size, 13px);
    color: var(--vscode-foreground);
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--vscode-editor-background) 88%, var(--surface) 12%), var(--vscode-editor-background) 160px);
    margin: 0; padding: 0;
  }

  /* Toolbar */
  .toolbar {
    display: flex; align-items: center; gap: var(--gap);
    padding: 10px 14px; border-bottom: 1px solid var(--border-soft);
    position: sticky; top: 0; z-index: 5;
    background: color-mix(in srgb, var(--vscode-editor-background) 82%, var(--surface) 18%);
    backdrop-filter: blur(10px);
    flex-wrap: wrap;
  }
  .toolbar .spacer { flex: 1 1 auto; }
  .title { font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 8px; letter-spacing: 0.01em; }
  .subtle { color: var(--muted); font-size: 12px; }

  /* Tabs */
  .tabs { display: flex; gap: 4px; padding: 8px 10px 0; border-bottom: 1px solid var(--border-soft);
    background: color-mix(in srgb, var(--vscode-editor-background) 86%, var(--surface) 14%); position: sticky; top: 0; z-index: 4; overflow-x: auto; }
  .tab {
    padding: 8px 14px; cursor: pointer; border: 1px solid transparent; background: transparent;
    color: var(--muted); font-size: 12px; border-radius: var(--radius) var(--radius) 0 0; border-bottom: 2px solid transparent; white-space: nowrap;
    transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
  }
  .tab:hover { color: var(--vscode-foreground); background: var(--hover); }
  .tab.active {
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    border-color: var(--border-soft);
    border-bottom-color: var(--vscode-focusBorder, var(--vscode-button-background));
  }
  .panel { display: none; }
  .panel.active { display: block; }

  /* Buttons */
  button.btn {
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);
    border: 1px solid transparent; padding: 5px 11px; border-radius: var(--radius);
    cursor: pointer; font-size: 12px; font-family: inherit;
    min-height: 28px;
    transition: transform 120ms ease, background 120ms ease, border-color 120ms ease, opacity 120ms ease;
  }
  button.btn:hover { background: var(--vscode-button-secondaryHoverBackground, var(--vscode-button-secondaryBackground)); transform: translateY(-1px); }
  button.btn.primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  button.btn.primary:hover { background: var(--vscode-button-hoverBackground, var(--vscode-button-background)); }
  button.btn.danger { color: var(--vscode-errorForeground); }
  button.btn:disabled { opacity: 0.5; cursor: default; }
  button.btn:focus-visible, button.icon-btn:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 2px; }
  button.icon-btn { background: transparent; border: 1px solid transparent; color: var(--muted); cursor: pointer; padding: 3px 7px; border-radius: 5px; font-size: 12px; transition: background 120ms ease, color 120ms ease; }
  button.icon-btn:hover { background: var(--vscode-toolbar-hoverBackground, var(--vscode-list-hoverBackground)); color: var(--vscode-foreground); }

  input, select, textarea {
    background: var(--vscode-input-background); color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, var(--border-soft)); border-radius: var(--radius);
    padding: 5px 8px; font-family: inherit; font-size: 12px; min-height: 28px;
    transition: border-color 120ms ease, box-shadow 120ms ease, background 120ms ease;
  }
  input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: var(--vscode-focusBorder);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--vscode-focusBorder) 24%, transparent);
  }

  /* Data grid */
  .grid-wrap { overflow: auto; border-top: 1px solid var(--border-soft); }
  table { border-collapse: separate; border-spacing: 0; width: 100%; font-size: 12px; }
  th, td { border: 0; border-right: 1px solid var(--border-soft); border-bottom: 1px solid var(--border-soft); padding: 7px 10px; text-align: left; white-space: nowrap; vertical-align: top; }
  th {
    position: sticky; top: 0;
    background: color-mix(in srgb, var(--vscode-keybindingTable-headerBackground, var(--surface)) 86%, var(--vscode-editor-background) 14%);
    font-weight: 700; z-index: 1; color: var(--vscode-foreground);
  }
  tbody tr:nth-child(even) td { background: color-mix(in srgb, var(--hover) 58%, transparent); }
  tbody tr:hover td { background: var(--active); }
  td.editable { cursor: text; }
  td.editing { padding: 2px; background: var(--vscode-input-background) !important; }
  td.pk { font-weight: 600; }
  td.row-actions { min-width: 74px; white-space: nowrap; text-align: center; }
  tr.new-row td { background: var(--vscode-editorWidget-background, var(--vscode-list-hoverBackground)); }
  .null { color: var(--muted); font-style: italic; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; border: 1px solid var(--border-soft); color: var(--muted); background: color-mix(in srgb, var(--surface) 72%, transparent); }
  .pill.pk { color: var(--vscode-charts-yellow, #d7ba7d); border-color: currentColor; }
  .pill.yes { color: var(--vscode-charts-green, #89d185); }
  .pill.no { color: var(--muted); }

  .section { padding: 14px 16px; }
  .section h3 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .msg { padding: 22px; color: var(--muted); }
  .err { padding: 14px 16px; color: var(--vscode-errorForeground); white-space: pre-wrap; }
  .sql-box {
    margin: 0; padding: 12px 14px; background: var(--vscode-textCodeBlock-background, var(--surface));
    border: 1px solid var(--border-soft); border-radius: var(--radius); font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px; white-space: pre-wrap; overflow-x: auto;
  }
  .banner { padding: 7px 12px; font-size: 12px; border-bottom: 1px solid var(--border-soft); }
  .banner.prod { background: var(--vscode-inputValidation-warningBackground, rgba(255,180,0,0.15)); color: var(--vscode-inputValidation-warningForeground, var(--vscode-foreground)); }
  .toast { position: fixed; bottom: 14px; right: 14px; max-width: 60%; padding: 9px 12px; border-radius: var(--radius);
    background: var(--vscode-notifications-background, var(--surface)); border: 1px solid var(--border-soft);
    box-shadow: var(--shadow); font-size: 12px; opacity: 0; transform: translateY(4px); transition: opacity 0.18s ease, transform 0.18s ease; z-index: 20; }
  .toast.show { transform: translateY(0); }
  .toast.show { opacity: 1; }
  .toast.error { border-color: var(--vscode-errorForeground); }
</style>`;
}
