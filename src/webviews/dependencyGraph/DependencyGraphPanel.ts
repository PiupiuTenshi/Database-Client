import * as vscode from "vscode";
import { EXTENSION_DISPLAY_NAME } from "../../core/constants";
import type {
  ConnectionProfile,
  DependencyGraph,
  GraphDepth,
  GraphDirection,
  ObjectRef
} from "../../core/types";
import type { DependencyGraphService } from "../../services/DependencyGraphService";
import { detectCycles } from "../../services/graphBuilder";
import { TableDataPanel, type ObjectPanelDeps } from "../tableViewer/TableDataPanel";
import { buildCsp, getNonce } from "../WebviewBase";

interface IncomingMessage {
  type: "ready" | "rebuild" | "openTable" | "export" | "report" | "exportSvg";
  direction?: GraphDirection;
  depth?: GraphDepth;
  schema?: string;
  table?: string;
  svg?: string;
}

export interface DependencyGraphDeps extends ObjectPanelDeps {
  graphService: DependencyGraphService;
}

/** Webview for the FK/view dependency graph around one database object. */
export class DependencyGraphPanel {
  private static readonly panels = new Map<string, DependencyGraphPanel>();

  private readonly disposables: vscode.Disposable[] = [];
  private direction: GraphDirection = "both";
  private depth: GraphDepth = 2;
  private current: DependencyGraph = { nodes: [], edges: [] };

  static show(deps: DependencyGraphDeps, profile: ConnectionProfile, ref: ObjectRef): void {
    const key = `${profile.id}:${ref.schema ?? ""}:${ref.name}`;
    const existing = DependencyGraphPanel.panels.get(key);
    if (existing) {
      existing.panel.reveal(vscode.ViewColumn.Active);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "openDbNexus.dependencyGraph",
      `Graph: ${ref.name}`,
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    DependencyGraphPanel.panels.set(key, new DependencyGraphPanel(key, panel, deps, profile, ref));
  }

  private constructor(
    private readonly key: string,
    private readonly panel: vscode.WebviewPanel,
    private readonly deps: DependencyGraphDeps,
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
    switch (message.type) {
      case "ready":
        await this.rebuild();
        return;
      case "rebuild":
        this.direction = message.direction ?? this.direction;
        this.depth = message.depth ?? this.depth;
        await this.rebuild();
        return;
      case "openTable":
        if (message.table) {
          TableDataPanel.show(this.deps, this.profile, {
            schema: message.schema,
            name: message.table
          });
        }
        return;
      case "export":
        await this.exportJson();
        return;
      case "report":
        await this.openReport();
        return;
      case "exportSvg":
        if (message.svg) {
          await this.saveSvg(message.svg);
        }
        return;
    }
  }

  private async openReport(): Promise<void> {
    const markdown = await this.deps.graphService.buildReport(this.profile, this.ref);
    const doc = await vscode.workspace.openTextDocument({
      language: "markdown",
      content: markdown
    });
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
  }

  private async saveSvg(svg: string): Promise<void> {
    const uri = await vscode.window.showSaveDialog({
      filters: { "SVG image": ["svg"] },
      saveLabel: "Export graph as SVG"
    });
    if (uri) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(svg, "utf8"));
    }
  }

  private async rebuild(): Promise<void> {
    try {
      this.current = await this.deps.graphService.build(
        this.profile,
        this.ref,
        this.direction,
        this.depth
      );
      const cycles = detectCycles(this.current);
      const warnings = [...(this.current.warnings ?? [])];
      if (cycles.length > 0) {
        warnings.push(
          `Circular dependency detected: ${cycles.map((cycle) => cycle.join(" -> ")).join("; ")}`
        );
      }
      void this.panel.webview.postMessage({
        type: "graph",
        payload: {
          graph: this.current,
          center: this.current.center,
          direction: this.direction,
          depth: this.depth,
          warnings
        }
      });
    } catch (error) {
      void this.panel.webview.postMessage({
        type: "error",
        payload: { message: error instanceof Error ? error.message : String(error) }
      });
    }
  }

  private async exportJson(): Promise<void> {
    const doc = await vscode.workspace.openTextDocument({
      language: "json",
      content: JSON.stringify(this.current, null, 2)
    });
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
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
  * { box-sizing: border-box; }
  body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    margin: 0;
    overflow: hidden;
  }
  .app { display: grid; grid-template-rows: auto 1fr; height: 100vh; min-width: 640px; }
  .toolbar {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 8px 10px;
    border-bottom: 1px solid var(--vscode-panel-border);
    background: var(--vscode-sideBar-background);
    font-size: 12px;
    flex-wrap: wrap;
  }
  .toolbar label { color: var(--vscode-descriptionForeground); }
  select, input, button {
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 4px;
    padding: 4px 7px;
    font-size: 12px;
  }
  button {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    cursor: pointer;
    border: none;
  }
  button:hover { background: var(--vscode-button-secondaryHoverBackground); }
  .spacer { flex: 1 1 auto; }
  .metrics { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .metric {
    min-width: 76px;
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    padding: 4px 8px;
    background: var(--vscode-editorWidget-background);
  }
  .metric strong { display: block; font-size: 13px; line-height: 16px; }
  .metric span {
    display: block;
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    text-transform: uppercase;
  }
  .content { display: grid; grid-template-columns: minmax(420px, 1fr) 300px; min-height: 0; }
  .graph-shell { position: relative; min-width: 0; min-height: 0; }
  #warn {
    display: none;
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
    z-index: 2;
    color: var(--vscode-editorWarning-foreground);
    background: var(--vscode-editorWidget-background);
    border: 1px solid var(--vscode-editorWarning-border, var(--vscode-panel-border));
    border-radius: 6px;
    padding: 7px 9px;
    font-size: 12px;
  }
  svg {
    width: 100%;
    height: 100%;
    display: block;
    cursor: grab;
    background:
      linear-gradient(var(--vscode-editorIndentGuide-background, rgba(127,127,127,0.10)) 1px, transparent 1px),
      linear-gradient(90deg, var(--vscode-editorIndentGuide-background, rgba(127,127,127,0.10)) 1px, transparent 1px);
    background-size: 28px 28px;
  }
  svg.grabbing { cursor: grabbing; }
  .edge {
    fill: none;
    stroke: var(--vscode-editorLineNumber-foreground);
    stroke-width: 1.6;
    opacity: 0.68;
    cursor: pointer;
  }
  .edge.view { stroke: var(--vscode-charts-blue, #3794ff); stroke-dasharray: 7 4; }
  .edge.selected { stroke: var(--vscode-focusBorder); stroke-width: 3; opacity: 1; }
  .edge.related { stroke: var(--vscode-charts-green, #89d185); opacity: 0.95; }
  .edge.dim { opacity: 0.12; }
  .edge-label rect {
    fill: var(--vscode-editorWidget-background);
    stroke: var(--vscode-panel-border);
    rx: 4;
  }
  .edge-label text { fill: var(--vscode-descriptionForeground); font-size: 10px; pointer-events: none; }
  .node { cursor: pointer; }
  .node rect.outer {
    fill: var(--vscode-editorWidget-background);
    stroke: var(--vscode-panel-border);
    stroke-width: 1;
    rx: 7;
    filter: url(#nodeShadow);
  }
  .node text { fill: var(--vscode-foreground); font-size: 11px; pointer-events: none; }
  .node .title { font-size: 13px; font-weight: 700; }
  .node .muted { fill: var(--vscode-descriptionForeground); font-size: 10px; }
  .node .badge { fill: var(--vscode-badge-background); }
  .node .badgeText { fill: var(--vscode-badge-foreground); font-size: 9px; font-weight: 700; }
  .node.view rect.outer { stroke: var(--vscode-charts-blue, #3794ff); }
  .node.center rect.outer { stroke: var(--vscode-focusBorder); stroke-width: 2.5; }
  .node.selected rect.outer { stroke: var(--vscode-charts-yellow, #cca700); stroke-width: 2.5; }
  .node.related rect.outer { stroke: var(--vscode-charts-green, #89d185); stroke-width: 2; }
  .node.match rect.outer { stroke: var(--vscode-charts-yellow, #cca700); stroke-width: 3; }
  .node.dim { opacity: 0.22; }
  .legend {
    position: absolute;
    left: 10px;
    bottom: 10px;
    display: flex;
    gap: 10px;
    align-items: center;
    color: var(--vscode-descriptionForeground);
    background: var(--vscode-editorWidget-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 11px;
  }
  .swatch {
    display: inline-block;
    width: 18px;
    height: 3px;
    margin-right: 5px;
    vertical-align: middle;
    background: var(--vscode-editorLineNumber-foreground);
  }
  .swatch.view {
    background: var(--vscode-charts-blue, #3794ff);
    border-top: 1px dashed var(--vscode-charts-blue, #3794ff);
  }
  aside {
    min-width: 0;
    border-left: 1px solid var(--vscode-panel-border);
    background: var(--vscode-sideBar-background);
    overflow: auto;
  }
  .details { padding: 12px; }
  .details h2 { margin: 0 0 3px; font-size: 14px; line-height: 20px; }
  .details h3 {
    margin: 16px 0 7px;
    color: var(--vscode-descriptionForeground);
    font-size: 11px;
    text-transform: uppercase;
  }
  .details p { margin: 0; color: var(--vscode-descriptionForeground); font-size: 12px; line-height: 18px; }
  .kv { display: grid; grid-template-columns: 84px 1fr; gap: 6px 10px; margin-top: 12px; font-size: 12px; }
  .kv span:nth-child(odd) { color: var(--vscode-descriptionForeground); }
  .pill-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .pill {
    border: 1px solid var(--vscode-panel-border);
    border-radius: 999px;
    padding: 3px 7px;
    background: var(--vscode-editorWidget-background);
    font-size: 11px;
  }
  .edge-list { display: grid; gap: 7px; }
  .edge-item {
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    padding: 7px;
    background: var(--vscode-editorWidget-background);
    font-size: 11px;
    cursor: pointer;
  }
  .edge-item strong { display: block; margin-bottom: 3px; font-size: 12px; }
  .edge-item span { color: var(--vscode-descriptionForeground); }
  .action-row { display: flex; gap: 7px; margin-top: 12px; flex-wrap: wrap; }
  @media (max-width: 820px) {
    .content { grid-template-columns: 1fr; grid-template-rows: minmax(340px, 1fr) 240px; }
    aside { border-left: none; border-top: 1px solid var(--vscode-panel-border); }
  }
</style>
</head>
<body>
  <div class="app">
    <div class="toolbar">
      <label>Direction</label>
      <select id="direction">
        <option value="both">both</option>
        <option value="outbound">outbound</option>
        <option value="inbound">inbound</option>
      </select>
      <label>Depth</label>
      <select id="depth">
        <option value="1">1</option>
        <option value="2" selected>2</option>
        <option value="3">3</option>
        <option value="all">all</option>
      </select>
      <input id="search" type="text" placeholder="Search table or view" />
      <button id="fit">Fit</button>
      <button id="export">JSON</button>
      <button id="svg">SVG</button>
      <button id="report">Report</button>
      <div class="spacer"></div>
      <div id="metrics" class="metrics"></div>
    </div>
    <div class="content">
      <div class="graph-shell">
        <div id="warn"></div>
        <svg id="canvas">
          <defs>
            <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill="var(--vscode-editorLineNumber-foreground, #777777)"></path>
            </marker>
            <marker id="arrowView" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill="var(--vscode-charts-blue, #3794ff)"></path>
            </marker>
            <filter id="nodeShadow" x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.22"></feDropShadow>
            </filter>
          </defs>
          <g id="viewport"></g>
        </svg>
        <div class="legend">
          <span><i class="swatch"></i>Foreign key</span>
          <span><i class="swatch view"></i>View reference</span>
        </div>
      </div>
      <aside><div id="details" class="details"></div></aside>
    </div>
  </div>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  const SVGNS = "http://www.w3.org/2000/svg";
  const NODE_W = 188;
  const NODE_H = 76;
  let view = { x: 0, y: 0, scale: 1 };
  let graph = { nodes: [], edges: [] };
  let center = null;
  let positions = new Map();
  let stats = { node: new Map(), totalInbound: 0, totalOutbound: 0 };
  let selectedNodeId = null;
  let selectedEdgeId = null;
  let searchTerm = "";

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function short(s, max) {
    const value = String(s || "");
    return value.length > max ? value.slice(0, Math.max(0, max - 1)) + "..." : value;
  }
  function nodeById(id) {
    return graph.nodes.find((n) => n.id === id);
  }
  function edgeById(id) {
    return graph.edges.find((e) => e.id === id);
  }
  function edgeLabel(e) {
    if (!e) return "";
    if (e.type === "view_reference") return "VIEW: references";
    const source = (e.sourceColumns || []).join(", ") || "source";
    const target = (e.targetColumns || []).join(", ") || "target";
    return "FK: " + source + " -> " + target;
  }
  function edgeTitle(e) {
    const source = nodeById(e.source);
    const target = nodeById(e.target);
    return (source ? source.label : e.source) + " -> " + (target ? target.label : e.target);
  }
  function computeStats() {
    const node = new Map();
    for (const n of graph.nodes) node.set(n.id, { inbound: 0, outbound: 0, related: [] });
    for (const e of graph.edges) {
      const sourceStats = node.get(e.source);
      const targetStats = node.get(e.target);
      if (sourceStats) {
        sourceStats.outbound += 1;
        sourceStats.related.push(e);
      }
      if (targetStats) {
        targetStats.inbound += 1;
        targetStats.related.push(e);
      }
    }
    const centerStats = center ? node.get(center) : undefined;
    stats = {
      node,
      totalInbound: centerStats ? centerStats.inbound : 0,
      totalOutbound: centerStats ? centerStats.outbound : 0
    };
  }
  function applyView() {
    $("viewport").setAttribute("transform", "translate(" + view.x + "," + view.y + ") scale(" + view.scale + ")");
  }
  function walk(start, adjacency) {
    const distance = new Map();
    const queue = [];
    if (start && adjacency.has(start)) {
      distance.set(start, 0);
      queue.push(start);
    }
    while (queue.length) {
      const id = queue.shift();
      for (const next of adjacency.get(id) || []) {
        if (!distance.has(next)) {
          distance.set(next, distance.get(id) + 1);
          queue.push(next);
        }
      }
    }
    return distance;
  }
  function layout() {
    const outgoing = new Map();
    const incoming = new Map();
    graph.nodes.forEach((n) => {
      outgoing.set(n.id, []);
      incoming.set(n.id, []);
    });
    graph.edges.forEach((e) => {
      if (outgoing.has(e.source)) outgoing.get(e.source).push(e.target);
      if (incoming.has(e.target)) incoming.get(e.target).push(e.source);
    });
    const start = center && outgoing.has(center) ? center : graph.nodes[0].id;
    const outbound = walk(start, outgoing);
    const inbound = walk(start, incoming);
    const groups = { left: new Map(), right: new Map(), bottom: new Map() };
    function add(group, level, node) {
      const bucket = group.get(level) || [];
      bucket.push(node);
      group.set(level, bucket);
    }
    for (const n of graph.nodes) {
      if (n.id === start) continue;
      const out = outbound.get(n.id);
      const inc = inbound.get(n.id);
      const hasOut = out !== undefined;
      const hasIn = inc !== undefined;
      const level = Math.max(1, Math.min(hasOut ? out : 99, hasIn ? inc : 99, 8));
      if (hasOut && hasIn) add(groups.bottom, level, n);
      else if (hasIn) add(groups.left, level, n);
      else add(groups.right, level, n);
    }
    const pos = new Map();
    pos.set(start, { x: 0, y: 0 });
    function placeSide(group, side) {
      for (const [level, nodes] of group) {
        nodes.sort((a, b) => a.label.localeCompare(b.label));
        nodes.forEach((n, i) => {
          const offset = (i - (nodes.length - 1) / 2) * 112;
          if (side === "left") pos.set(n.id, { x: -level * 285, y: offset });
          if (side === "right") pos.set(n.id, { x: level * 285, y: offset });
          if (side === "bottom") pos.set(n.id, { x: offset * 1.55, y: level * 150 + 92 });
        });
      }
    }
    placeSide(groups.left, "left");
    placeSide(groups.right, "right");
    placeSide(groups.bottom, "bottom");
    return pos;
  }
  function makeText(parent, className, x, y, value, anchor) {
    const text = document.createElementNS(SVGNS, "text");
    if (className) text.setAttribute("class", className);
    text.setAttribute("x", x);
    text.setAttribute("y", y);
    if (anchor) text.setAttribute("text-anchor", anchor);
    text.textContent = value;
    parent.appendChild(text);
    return text;
  }
  function renderMetrics() {
    const tables = graph.nodes.filter((n) => n.type === "table").length;
    const views = graph.nodes.filter((n) => n.type === "view").length;
    const fks = graph.edges.filter((e) => e.type === "foreign_key").length;
    const viewRefs = graph.edges.filter((e) => e.type === "view_reference").length;
    $("metrics").innerHTML =
      '<div class="metric"><strong>' + graph.nodes.length + '</strong><span>nodes</span></div>' +
      '<div class="metric"><strong>' + graph.edges.length + '</strong><span>edges</span></div>' +
      '<div class="metric"><strong>' + tables + '/' + views + '</strong><span>tables/views</span></div>' +
      '<div class="metric"><strong>' + fks + '/' + viewRefs + '</strong><span>fk/view</span></div>';
  }
  function render() {
    const vp = $("viewport");
    vp.innerHTML = "";
    computeStats();
    renderMetrics();
    if (!graph.nodes.length) {
      $("details").innerHTML = '<h2>No graph data</h2><p>The current object has no known dependencies.</p>';
      return;
    }
    positions = layout();
    const edgeLayer = document.createElementNS(SVGNS, "g");
    const labelLayer = document.createElementNS(SVGNS, "g");
    const nodeLayer = document.createElementNS(SVGNS, "g");
    vp.appendChild(edgeLayer);
    vp.appendChild(labelLayer);
    vp.appendChild(nodeLayer);
    for (const e of graph.edges) {
      const s = positions.get(e.source);
      const t = positions.get(e.target);
      if (!s || !t) continue;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const startX = s.x + dx / len * (NODE_W / 2);
      const startY = s.y + dy / len * (NODE_H / 2);
      const endX = t.x - dx / len * (NODE_W / 2 + 8);
      const endY = t.y - dy / len * (NODE_H / 2 + 8);
      const curve = Math.max(-48, Math.min(48, dx * 0.08));
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2 - curve;
      const path = document.createElementNS(SVGNS, "path");
      path.setAttribute("d", "M " + startX + " " + startY + " Q " + midX + " " + midY + " " + endX + " " + endY);
      path.setAttribute("class", "edge" + (e.type === "view_reference" ? " view" : ""));
      path.setAttribute("marker-end", e.type === "view_reference" ? "url(#arrowView)" : "url(#arrow)");
      path.dataset.id = e.id;
      const title = document.createElementNS(SVGNS, "title");
      title.textContent = edgeTitle(e) + " | " + edgeLabel(e);
      path.appendChild(title);
      path.addEventListener("click", (event) => {
        event.stopPropagation();
        selectedEdgeId = e.id;
        selectedNodeId = null;
        renderDetails();
        refreshSelection();
      });
      path.addEventListener("mousedown", (event) => event.stopPropagation());
      edgeLayer.appendChild(path);
      const label = document.createElementNS(SVGNS, "g");
      label.setAttribute("class", "edge-label");
      label.setAttribute("transform", "translate(" + midX + "," + (midY - 7) + ")");
      label.dataset.id = e.id;
      const textValue = short(edgeLabel(e), 28);
      const labelW = Math.max(64, Math.min(178, textValue.length * 5.8 + 18));
      const rect = document.createElementNS(SVGNS, "rect");
      rect.setAttribute("x", -labelW / 2);
      rect.setAttribute("y", -11);
      rect.setAttribute("width", labelW);
      rect.setAttribute("height", 18);
      label.appendChild(rect);
      makeText(label, "", 0, 2, textValue, "middle");
      label.addEventListener("click", (event) => {
        event.stopPropagation();
        selectedEdgeId = e.id;
        selectedNodeId = null;
        renderDetails();
        refreshSelection();
      });
      label.addEventListener("mousedown", (event) => event.stopPropagation());
      labelLayer.appendChild(label);
    }
    for (const n of graph.nodes) {
      const p = positions.get(n.id);
      if (!p) continue;
      const g = document.createElementNS(SVGNS, "g");
      g.setAttribute("class", "node " + n.type + (n.id === center ? " center" : ""));
      g.setAttribute("transform", "translate(" + (p.x - NODE_W / 2) + "," + (p.y - NODE_H / 2) + ")");
      g.dataset.id = n.id;
      g.dataset.table = n.objectName;
      if (n.schema) g.dataset.schema = n.schema;
      const rect = document.createElementNS(SVGNS, "rect");
      rect.setAttribute("class", "outer");
      rect.setAttribute("width", NODE_W);
      rect.setAttribute("height", NODE_H);
      g.appendChild(rect);
      const typeWidth = n.type === "view" ? 42 : 46;
      const badge = document.createElementNS(SVGNS, "rect");
      badge.setAttribute("class", "badge");
      badge.setAttribute("x", 10);
      badge.setAttribute("y", 9);
      badge.setAttribute("width", typeWidth);
      badge.setAttribute("height", 16);
      badge.setAttribute("rx", 8);
      g.appendChild(badge);
      makeText(g, "badgeText", 10 + typeWidth / 2, 21, n.type.toUpperCase(), "middle");
      const degree = stats.node.get(n.id) || { inbound: 0, outbound: 0 };
      makeText(g, "muted", NODE_W - 10, 21, "in " + degree.inbound + " / out " + degree.outbound, "end");
      makeText(g, "title", 10, 45, short(n.label, 24));
      makeText(g, "muted", 10, 64, short(n.schema ? n.schema + "." + n.objectName : n.objectName, 30));
      const title = document.createElementNS(SVGNS, "title");
      title.textContent = n.id + " | inbound " + degree.inbound + ", outbound " + degree.outbound;
      g.appendChild(title);
      g.addEventListener("click", (event) => {
        event.stopPropagation();
        selectedNodeId = n.id;
        selectedEdgeId = null;
        renderDetails();
        refreshSelection();
      });
      g.addEventListener("mousedown", (event) => event.stopPropagation());
      g.addEventListener("dblclick", () => vscode.postMessage({ type: "openTable", schema: n.schema, table: n.objectName }));
      nodeLayer.appendChild(g);
    }
    if (!selectedNodeId && !selectedEdgeId) selectedNodeId = center || graph.nodes[0].id;
    renderDetails();
    refreshSelection();
  }
  function fit() {
    const canvas = $("canvas");
    if (!positions.size) {
      view = { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2, scale: 1 };
      applyView();
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of positions.values()) {
      minX = Math.min(minX, p.x - NODE_W / 2 - 70);
      minY = Math.min(minY, p.y - NODE_H / 2 - 70);
      maxX = Math.max(maxX, p.x + NODE_W / 2 + 70);
      maxY = Math.max(maxY, p.y + NODE_H / 2 + 70);
    }
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const scale = Math.max(0.22, Math.min(1.35, Math.min((canvas.clientWidth - 42) / width, (canvas.clientHeight - 42) / height)));
    view = {
      x: (canvas.clientWidth - (minX + maxX) * scale) / 2,
      y: (canvas.clientHeight - (minY + maxY) * scale) / 2,
      scale
    };
    applyView();
  }
  function isIncident(edge, nodeId) {
    return edge.source === nodeId || edge.target === nodeId;
  }
  function refreshSelection() {
    const selectedEdge = selectedEdgeId ? edgeById(selectedEdgeId) : null;
    const relatedNodes = new Set();
    const relatedEdges = new Set();
    if (selectedNodeId) {
      relatedNodes.add(selectedNodeId);
      for (const e of graph.edges) {
        if (isIncident(e, selectedNodeId)) {
          relatedEdges.add(e.id);
          relatedNodes.add(e.source);
          relatedNodes.add(e.target);
        }
      }
    }
    if (selectedEdge) {
      relatedEdges.add(selectedEdge.id);
      relatedNodes.add(selectedEdge.source);
      relatedNodes.add(selectedEdge.target);
    }
    document.querySelectorAll(".node").forEach((g) => {
      const id = g.dataset.id;
      g.classList.remove("selected", "related", "dim", "match");
      const searchable = ((g.dataset.table || "") + " " + (g.dataset.schema || "") + " " + id).toLowerCase();
      if (searchTerm && searchable.includes(searchTerm)) g.classList.add("match");
      if (selectedNodeId || selectedEdgeId) {
        if (id === selectedNodeId) g.classList.add("selected");
        else if (relatedNodes.has(id)) g.classList.add("related");
        else g.classList.add("dim");
      } else if (searchTerm && !searchable.includes(searchTerm)) {
        g.classList.add("dim");
      }
    });
    document.querySelectorAll(".edge").forEach((path) => {
      const id = path.dataset.id;
      path.classList.remove("selected", "related", "dim");
      if (id === selectedEdgeId) path.classList.add("selected");
      else if (relatedEdges.has(id)) path.classList.add("related");
      else if (selectedNodeId || selectedEdgeId || searchTerm) path.classList.add("dim");
    });
    document.querySelectorAll(".edge-label").forEach((label) => {
      label.style.opacity = relatedEdges.size === 0 || relatedEdges.has(label.dataset.id) ? "1" : "0.24";
    });
  }
  function renderDetails() {
    if (selectedEdgeId) {
      const e = edgeById(selectedEdgeId);
      if (!e) return;
      const source = nodeById(e.source);
      const target = nodeById(e.target);
      $("details").innerHTML =
        '<h2>' + esc(edgeTitle(e)) + '</h2>' +
        '<p>' + esc(edgeLabel(e)) + '</p>' +
        '<div class="kv">' +
        '<span>Type</span><span>' + esc(e.type) + '</span>' +
        '<span>Source</span><span>' + esc(source ? source.id : e.source) + '</span>' +
        '<span>Target</span><span>' + esc(target ? target.id : e.target) + '</span>' +
        '<span>Columns</span><span>' + esc((e.sourceColumns || []).join(", ") || "-") + ' -> ' + esc((e.targetColumns || []).join(", ") || "-") + '</span>' +
        '</div>' +
        '<div class="action-row">' +
        '<button id="openSource">Open source</button><button id="openTarget">Open target</button>' +
        '</div>';
      const openSource = $("openSource");
      const openTarget = $("openTarget");
      if (openSource && source) openSource.addEventListener("click", () => vscode.postMessage({ type: "openTable", schema: source.schema, table: source.objectName }));
      if (openTarget && target) openTarget.addEventListener("click", () => vscode.postMessage({ type: "openTable", schema: target.schema, table: target.objectName }));
      return;
    }
    const n = selectedNodeId ? nodeById(selectedNodeId) : nodeById(center);
    if (!n) {
      $("details").innerHTML = '<h2>No selection</h2><p>Graph contains ' + graph.nodes.length + ' nodes and ' + graph.edges.length + ' edges.</p>';
      return;
    }
    const degree = stats.node.get(n.id) || { inbound: 0, outbound: 0, related: [] };
    const related = (degree.related || []).slice().sort((a, b) => edgeTitle(a).localeCompare(edgeTitle(b)));
    $("details").innerHTML =
      '<h2>' + esc(n.label) + '</h2>' +
      '<p>' + esc(n.schema ? n.schema + "." + n.objectName : n.objectName) + '</p>' +
      '<div class="pill-row">' +
      '<span class="pill">' + esc(n.type) + '</span>' +
      '<span class="pill">inbound ' + degree.inbound + '</span>' +
      '<span class="pill">outbound ' + degree.outbound + '</span>' +
      (n.id === center ? '<span class="pill">center</span>' : '') +
      '</div>' +
      '<div class="action-row"><button id="openSelected">Open data</button></div>' +
      '<h3>Related edges</h3>' +
      '<div class="edge-list">' +
      (related.length ? related.map((e) =>
        '<div class="edge-item" data-edge="' + esc(e.id) + '"><strong>' + esc(edgeTitle(e)) + '</strong><span>' + esc(edgeLabel(e)) + '</span></div>'
      ).join("") : '<p>No direct edges.</p>') +
      '</div>';
    const openSelected = $("openSelected");
    if (openSelected) openSelected.addEventListener("click", () => vscode.postMessage({ type: "openTable", schema: n.schema, table: n.objectName }));
    document.querySelectorAll(".edge-item").forEach((item) => {
      item.addEventListener("click", () => {
        selectedEdgeId = item.dataset.edge;
        selectedNodeId = null;
        renderDetails();
        refreshSelection();
      });
    });
  }

  const svg = $("canvas");
  let panning = false;
  let sx = 0;
  let sy = 0;
  svg.addEventListener("mousedown", (event) => {
    panning = true;
    sx = event.clientX - view.x;
    sy = event.clientY - view.y;
    svg.classList.add("grabbing");
  });
  window.addEventListener("mouseup", () => {
    panning = false;
    svg.classList.remove("grabbing");
  });
  window.addEventListener("mousemove", (event) => {
    if (panning) {
      view.x = event.clientX - sx;
      view.y = event.clientY - sy;
      applyView();
    }
  });
  svg.addEventListener("wheel", (event) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.1 : 0.9;
    view.scale = Math.max(0.2, Math.min(3, view.scale * factor));
    applyView();
  }, { passive: false });
  svg.addEventListener("click", () => {
    selectedEdgeId = null;
    selectedNodeId = null;
    renderDetails();
    refreshSelection();
  });
  $("search").addEventListener("input", (event) => {
    searchTerm = event.target.value.trim().toLowerCase();
    if (searchTerm) {
      selectedNodeId = null;
      selectedEdgeId = null;
      renderDetails();
    }
    refreshSelection();
  });
  $("direction").addEventListener("change", (event) => vscode.postMessage({ type: "rebuild", direction: event.target.value }));
  $("depth").addEventListener("change", (event) => {
    const value = event.target.value;
    vscode.postMessage({ type: "rebuild", depth: value === "all" ? "all" : Number(value) });
  });
  $("fit").addEventListener("click", fit);
  $("export").addEventListener("click", () => vscode.postMessage({ type: "export" }));
  $("report").addEventListener("click", () => vscode.postMessage({ type: "report" }));
  $("svg").addEventListener("click", () => {
    const clone = $("canvas").cloneNode(true);
    clone.setAttribute("xmlns", SVGNS);
    const style = document.createElementNS(SVGNS, "style");
    style.textContent = ".edge{fill:none;stroke:#777;stroke-width:1.6}.edge.view{stroke:#3794ff;stroke-dasharray:7 4}.node rect.outer{fill:#fff;stroke:#777;stroke-width:1}.node.view rect.outer{stroke:#3794ff}.node.center rect.outer{stroke:#006ab1;stroke-width:2.5}.node text{font:12px sans-serif;fill:#111}.edge-label rect{fill:#fff;stroke:#ddd}.edge-label text{font:10px sans-serif;fill:#444}";
    clone.insertBefore(style, clone.firstChild);
    vscode.postMessage({ type: "exportSvg", svg: clone.outerHTML });
  });
  window.addEventListener("resize", fit);
  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (msg.type === "graph") {
      graph = msg.payload.graph;
      center = msg.payload.center;
      selectedNodeId = center || (graph.nodes[0] && graph.nodes[0].id) || null;
      selectedEdgeId = null;
      $("direction").value = msg.payload.direction;
      $("depth").value = String(msg.payload.depth);
      const warningText = (msg.payload.warnings || []).join(" | ");
      $("warn").textContent = warningText;
      $("warn").style.display = warningText ? "block" : "none";
      render();
      fit();
    } else if (msg.type === "error") {
      $("warn").textContent = msg.payload.message;
      $("warn").style.display = "block";
    }
  });

  fit();
  vscode.postMessage({ type: "ready" });
</script>
</body>
</html>`;
  }

  private dispose(): void {
    DependencyGraphPanel.panels.delete(this.key);
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }
}
