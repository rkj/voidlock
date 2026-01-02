import { CampaignManager } from "../campaign/CampaignManager";
import { CampaignNode } from "../../shared/campaign_types";

export class CampaignScreen {
  private container: HTMLElement;
  private manager: CampaignManager;
  private onNodeSelect: (node: CampaignNode) => void;
  private onBack: () => void;

  constructor(
    containerId: string,
    manager: CampaignManager,
    onNodeSelect: (node: CampaignNode) => void,
    onBack: () => void,
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.manager = manager;
    this.onNodeSelect = onNodeSelect;
    this.onBack = onBack;
  }

  public show() {
    this.container.style.display = "flex";
    this.render();
  }

  public hide() {
    this.container.style.display = "none";
  }

  private render() {
    this.container.innerHTML = "";
    this.container.className = "screen campaign-screen";
    this.container.style.backgroundColor = "#111";
    this.container.style.color = "#eee";
    this.container.style.position = "relative";
    this.container.style.overflow = "hidden";
    this.container.style.display = "flex";
    this.container.style.flexDirection = "column";

    const state = this.manager.getState();
    if (!state) {
      this.renderNoCampaign();
      return;
    }

    // Header
    const header = document.createElement("div");
    header.style.padding = "20px";
    header.style.borderBottom = "1px solid #333";
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.background = "#1a1a1a";

    const title = document.createElement("h1");
    title.textContent = "SECTOR MAP";
    title.style.margin = "0";
    title.style.fontSize = "1.5em";
    header.appendChild(title);

    const stats = document.createElement("div");
    stats.style.display = "flex";
    stats.style.gap = "20px";
    stats.innerHTML = `
      <span>SCRAP: <span style="color:#0f0">${state.scrap}</span></span>
      <span>INTEL: <span style="color:#0af">${state.intel}</span></span>
      <span>SECTOR: <span style="color:#eee">${state.currentSector}</span></span>
    `;
    header.appendChild(stats);

    this.container.appendChild(header);

    // Map Viewport
    const viewport = document.createElement("div");
    viewport.style.flexGrow = "1";
    viewport.style.position = "relative";
    viewport.style.overflow = "auto";
    viewport.style.padding = "100px";
    viewport.style.background =
      "radial-gradient(circle, #1a1a1a 0%, #000 100%)";

    this.renderMap(viewport, state.nodes);
    this.container.appendChild(viewport);

    // Footer
    const footer = document.createElement("div");
    footer.style.padding = "20px";
    footer.style.borderTop = "1px solid #333";
    footer.style.display = "flex";
    footer.style.justifyContent = "space-between";
    footer.style.background = "#1a1a1a";

    const backBtn = document.createElement("button");
    backBtn.textContent = "BACK TO MENU";
    backBtn.className = "back-button";
    backBtn.onclick = () => this.onBack();
    footer.appendChild(backBtn);

    const barracksBtn = document.createElement("button");
    barracksBtn.textContent = "BARRACKS (TODO)";
    barracksBtn.disabled = true;
    footer.appendChild(barracksBtn);

    this.container.appendChild(footer);
  }

  private renderNoCampaign() {
    const content = document.createElement("div");
    content.style.display = "flex";
    content.style.flexDirection = "column";
    content.style.alignItems = "center";
    content.style.justifyContent = "center";
    content.style.height = "100%";
    content.style.gap = "20px";

    const h1 = document.createElement("h1");
    h1.textContent = "NO ACTIVE CAMPAIGN";
    content.appendChild(h1);

    const backBtn = document.createElement("button");
    backBtn.textContent = "BACK TO MENU";
    backBtn.onclick = () => this.onBack();
    content.appendChild(backBtn);

    this.container.appendChild(content);
  }

  private renderMap(container: HTMLElement, nodes: CampaignNode[]) {
    // Canvas for connections
    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.pointerEvents = "none";
    container.appendChild(canvas);

    // Wait for a tick to get correct dimensions for canvas
    setTimeout(() => {
      canvas.width = container.scrollWidth;
      canvas.height = container.scrollHeight;
      this.drawConnections(canvas, nodes);
    }, 0);

    // Nodes
    nodes.forEach((node) => {
      const nodeEl = document.createElement("div");
      nodeEl.className = `campaign-node ${node.status.toLowerCase()}`;
      nodeEl.style.position = "absolute";
      nodeEl.style.left = `${node.position.x + 100}px`;
      nodeEl.style.top = `${node.position.y + 100}px`;
      nodeEl.style.width = "40px";
      nodeEl.style.height = "40px";
      nodeEl.style.borderRadius = "50%";
      nodeEl.style.border = "2px solid #444";
      nodeEl.style.display = "flex";
      nodeEl.style.alignItems = "center";
      nodeEl.style.justifyContent = "center";
      nodeEl.style.cursor = "pointer";
      nodeEl.style.transition = "all 0.2s";
      nodeEl.style.zIndex = "2";
      nodeEl.title = `${node.type} (Difficulty: ${node.difficulty.toFixed(1)})`;

      // Visuals based on status
      switch (node.status) {
        case "Hidden":
          nodeEl.style.opacity = "0";
          nodeEl.style.pointerEvents = "none";
          break;
        case "Revealed":
          nodeEl.style.opacity = "0.5";
          nodeEl.style.background = "#222";
          nodeEl.style.cursor = "default";
          break;
        case "Accessible":
          nodeEl.style.background = "#333";
          nodeEl.style.borderColor = "#0f0";
          nodeEl.style.boxShadow = "0 0 10px #0f0";
          nodeEl.onclick = () => this.onNodeSelect(node);
          break;
        case "Cleared":
          nodeEl.style.background = "#040";
          nodeEl.style.borderColor = "#080";
          nodeEl.style.cursor = "default";
          break;
      }

      // Icon/Text
      const icon = document.createElement("span");
      icon.style.fontSize = "0.8em";
      switch (node.type) {
        case "Combat":
          icon.textContent = "⚔️";
          break;
        case "Elite":
          icon.textContent = "💀";
          break;
        case "Shop":
          icon.textContent = "💰";
          break;
        case "Event":
          icon.textContent = "❓";
          break;
        case "Boss":
          icon.textContent = "👹";
          break;
      }
      nodeEl.appendChild(icon);

      container.appendChild(nodeEl);
    });
  }

  private drawConnections(canvas: HTMLCanvasElement, nodes: CampaignNode[]) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = "#444";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    nodes.forEach((node) => {
      if (node.status === "Hidden") return;

      node.connections.forEach((connId) => {
        const target = nodes.find((n) => n.id === connId);
        if (target && target.status !== "Hidden") {
          ctx.beginPath();
          ctx.moveTo(node.position.x + 120, node.position.y + 120);
          ctx.lineTo(target.position.x + 120, target.position.y + 120);

          if (
            node.status === "Cleared" &&
            (target.status === "Accessible" || target.status === "Cleared")
          ) {
            ctx.strokeStyle = "#080";
            ctx.setLineDash([]);
          } else {
            ctx.strokeStyle = "#444";
            ctx.setLineDash([5, 5]);
          }

          ctx.stroke();
        }
      });
    });
  }
}
