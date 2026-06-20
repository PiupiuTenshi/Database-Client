import * as vscode from "vscode";
import { EXTENSION_DISPLAY_NAME } from "../../core/constants";
import type {
  ConnectionProfile,
  DependencyGraph,
  GraphDepth,
  GraphDirection,
  ObjectRef
} from "../../core/types";
import type { DataEditService } from "../../services/DataEditService";
import type { DependencyGraphService } from "../../services/DependencyGraphService";
import type { QueryService } from "../../services/QueryService";
import type { SchemaService } from "../../services/SchemaService";
import { detectCycles } from "../../services/graphBuilder";
import { TableDataPanel } from "../tableViewer/TableDataPanel";
import { buildCsp, getNonce } from "../WebviewBase";

interface IncomingMessage {
  type: "ready" | "rebuild" | "openTable" | "export" | "report" | "exportSvg";
  direction?: GraphDirection;
  depth?: GraphDepth;
  schema?: string;
  table?: string;
  svg?: string;
}

export interface DependencyGraphDeps {
  graphService: DependencyGraphService;
  queryService: QueryService;
  schemaService: SchemaService;
  dataEditService: DataEditService;
}

/** Webview vẽ dependency graph (FK) cho một bảng. */
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
          TableDataPanel.show(
            {
              queryService: this.deps.queryService,
              schemaService: this.deps.schemaService,
              dataEditService: this.deps.dataEditService
            },
            this.profile,
            { schema: message.schema, name: message.table }
          );
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
          `Circular dependency detected: ${cycles.map((c) => c.join(" → ")).join("; ")}`
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
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); margin: 0; overflow: hidden; }
  .toolbar { display: flex; gap: 8px; align-items: center; padding: 6px 10px; border-bottom: 1px solid var(--vscode-panel-border); font-size: 12px; flex-wrap: wrap; }
  .toolbar label { opacity: 0.8; }
  select, input, button {
    background: var(--vscode-input-background); color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent); border-radius: 2px; padding: 3px 6px; font-size: 12px;
  }
  button { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); cursor: pointer; border: none; }
  #info { margin-left: auto; opacity: 0.7; }
  #warn { color: var(--vscode-editorWarning-foreground); padding: 0 10px; font-size: 12px; }
  svg { width: 100vw; height: calc(100vh - 40px); display: block; cursor: grab; }
  svg.grabbing { cursor: grabbing; }
  .edge { stroke: var(--vscode-editorLineNumber-foreground); stroke-width: 1.2; opacity: 0.6; }
  .edge.view { stroke-dasharray: 5 3; }
  .node.view rect { fill: var(--vscode-editorWidget-background); stroke: var(--vscode-charts-blue, #3794ff); }
  .node rect { fill: var(--vscode-editorWidget-background); stroke: var(--vscode-editorLineNumber-foreground); stroke-width: 1; rx: 4; cursor: pointer; }
  .node text { fill: var(--vscode-foreground); font-size: 12px; pointer-events: none; }
  .node.center rect { stroke: var(--vscode-focusBorder); stroke-width: 2; }
  .node.match rect { stroke: var(--vscode-charts-yellow, #cca700); stroke-width: 2.5; }
  .node.dim { opacity: 0.25; }
</style>
</head>
<body>
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
    <input id="search" type="text" placeholder="Search node…" />
    <button id="fit">Fit</button>
    <button id="export">Export JSON</button>
    <button id="svg">Export SVG</button>
    <button id="report">Report</button>
    <span id="info"></span>
  </div>
  <div id="warn"></div>
  <svg id="canvas"><g id="viewport"></g></svg>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  const SVGNS = "http://www.w3.org/2000/svg";
  let view = { x: 0, y: 0, scale: 1 };
  let graph = { nodes: [], edges: [] };
  let center = null;

  function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  function applyView() {
    $("viewport").setAttribute("transform", "translate(" + view.x + "," + view.y + ") scale(" + view.scale + ")");
  }

  function layout() {
    // BFS không hướng để gán ring level từ center.
    const adj = new Map();
    graph.nodes.forEach((n) => adj.set(n.id, []));
    graph.edges.forEach((e) => { adj.get(e.source)?.push(e.target); adj.get(e.target)?.push(e.source); });
    const level = new Map();
    const start = center && adj.has(center) ? center : graph.nodes[0] && graph.nodes[0].id;
    const queue = [];
    if (start) { level.set(start, 0); queue.push(start); }
    while (queue.length) {
      const id = queue.shift();
      for (const nb of adj.get(id) ?? []) if (!level.has(nb)) { level.set(nb, level.get(id) + 1); queue.push(nb); }
    }
    graph.nodes.forEach((n) => { if (!level.has(n.id)) level.set(n.id, 1); });
    const byLevel = new Map();
    graph.nodes.forEach((n) => { const l = level.get(n.id); (byLevel.get(l) ?? byLevel.set(l, []).get(l)).push(n); });
    const pos = new Map();
    for (const [l, nodes] of byLevel) {
      if (l === 0) { pos.set(nodes[0].id, { x: 0, y: 0 }); continue; }
      const r = l * 200;
      nodes.forEach((n, i) => {
        const a = (i / nodes.length) * Math.PI * 2;
        pos.set(n.id, { x: Math.cos(a) * r, y: Math.sin(a) * r });
      });
    }
    return pos;
  }

  function render() {
    const vp = $("viewport");
    vp.innerHTML = "";
    if (!graph.nodes.length) { $("info").textContent = "No nodes"; return; }
    const pos = layout();
    // edges
    for (const e of graph.edges) {
      const s = pos.get(e.source), t = pos.get(e.target);
      if (!s || !t) continue;
      const line = document.createElementNS(SVGNS, "line");
      line.setAttribute("x1", s.x); line.setAttribute("y1", s.y);
      line.setAttribute("x2", t.x); line.setAttribute("y2", t.y);
      line.setAttribute("class", "edge" + (e.type === "view_reference" ? " view" : ""));
      const title = document.createElementNS(SVGNS, "title");
      title.textContent = e.label ?? "";
      line.appendChild(title);
      vp.appendChild(line);
    }
    // nodes
    const W = 130, H = 34;
    for (const n of graph.nodes) {
      const p = pos.get(n.id); if (!p) continue;
      const g = document.createElementNS(SVGNS, "g");
      g.setAttribute("class", "node" + (n.id === center ? " center" : "") + (n.type === "view" ? " view" : ""));
      g.setAttribute("transform", "translate(" + (p.x - W / 2) + "," + (p.y - H / 2) + ")");
      g.dataset.id = n.id; g.dataset.table = n.objectName; if (n.schema) g.dataset.schema = n.schema;
      const rect = document.createElementNS(SVGNS, "rect");
      rect.setAttribute("width", W); rect.setAttribute("height", H);
      const text = document.createElementNS(SVGNS, "text");
      text.setAttribute("x", W / 2); text.setAttribute("y", H / 2 + 4); text.setAttribute("text-anchor", "middle");
      text.textContent = n.label;
      g.appendChild(rect); g.appendChild(text);
      g.addEventListener("dblclick", () => vscode.postMessage({ type: "openTable", schema: n.schema, table: n.objectName }));
      vp.appendChild(g);
    }
    $("info").textContent = graph.nodes.length + " nodes · " + graph.edges.length + " edges (double-click a node to open)";
  }

  function fit() { view = { x: window.innerWidth / 2, y: (window.innerHeight - 40) / 2, scale: 1 }; applyView(); }

  // pan + zoom
  const svg = $("canvas");
  let panning = false, sx = 0, sy = 0;
  svg.addEventListener("mousedown", (e) => { panning = true; sx = e.clientX - view.x; sy = e.clientY - view.y; svg.classList.add("grabbing"); });
  window.addEventListener("mouseup", () => { panning = false; svg.classList.remove("grabbing"); });
  window.addEventListener("mousemove", (e) => { if (panning) { view.x = e.clientX - sx; view.y = e.clientY - sy; applyView(); } });
  svg.addEventListener("wheel", (e) => { e.preventDefault(); const f = e.deltaY < 0 ? 1.1 : 0.9; view.scale = Math.max(0.2, Math.min(3, view.scale * f)); applyView(); }, { passive: false });

  $("search").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll(".node").forEach((g) => {
      g.classList.remove("match", "dim");
      if (!q) return;
      if ((g.dataset.table || "").toLowerCase().includes(q)) g.classList.add("match");
      else g.classList.add("dim");
    });
  });
  $("direction").addEventListener("change", (e) => vscode.postMessage({ type: "rebuild", direction: e.target.value }));
  $("depth").addEventListener("change", (e) => {
    const v = e.target.value;
    vscode.postMessage({ type: "rebuild", depth: v === "all" ? "all" : Number(v) });
  });
  $("fit").addEventListener("click", fit);
  $("export").addEventListener("click", () => vscode.postMessage({ type: "export" }));
  $("report").addEventListener("click", () => vscode.postMessage({ type: "report" }));
  $("svg").addEventListener("click", () => {
    const clone = $("canvas").cloneNode(true);
    clone.setAttribute("xmlns", SVGNS);
    const style = document.createElementNS(SVGNS, "style");
    style.textContent = ".edge{stroke:#888;stroke-width:1.2}.edge.view{stroke-dasharray:5 3}.node rect{fill:#fff;stroke:#888}.node.view rect{stroke:#3794ff}.node text{font:12px sans-serif;fill:#111;text-anchor:middle}";
    clone.insertBefore(style, clone.firstChild);
    vscode.postMessage({ type: "exportSvg", svg: clone.outerHTML });
  });

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (msg.type === "graph") {
      graph = msg.payload.graph; center = msg.payload.center;
      $("direction").value = msg.payload.direction;
      $("depth").value = String(msg.payload.depth);
      $("warn").textContent = (msg.payload.warnings || []).join(" · ");
      fit(); render();
    } else if (msg.type === "error") {
      $("warn").textContent = msg.payload.message;
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
