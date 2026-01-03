import { CampaignManager } from "../campaign/CampaignManager";
import { CampaignNode, CampaignState } from "../../shared/campaign_types";

export class CampaignScreen {
  private container: HTMLElement;
  private manager: CampaignManager;
  private onNodeSelect: (node: CampaignNode) => void;
  private onBarracks: () => void;
  private onBack: () => void;

  constructor(
    containerId: string,
    manager: CampaignManager,
    onNodeSelect: (node: CampaignNode) => void,
    onBarracks: () => void,
    onBack: () => void,
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.manager = manager;
    this.onNodeSelect = onNodeSelect;
    this.onBarracks = onBarracks;
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
      "radial-gradient(circle, #1a1a1a 0%, #000 100%), linear-gradient(#111 1px, transparent 1px), linear-gradient(90deg, #111 1px, transparent 1px)";
    viewport.style.backgroundSize = "100% 100%, 40px 40px, 40px 40px";

    // Scanline effect
    const scanline = document.createElement("div");
    scanline.style.position = "absolute";
    scanline.style.top = "0";
    scanline.style.left = "0";
    scanline.style.width = "100%";
    scanline.style.height = "100%";
    scanline.style.background =
      "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))";
    scanline.style.backgroundSize = "100% 4px, 3px 100%";
    scanline.style.pointerEvents = "none";
    scanline.style.zIndex = "5";
    viewport.appendChild(scanline);

    this.renderMap(viewport, state);
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
    barracksBtn.textContent = "BARRACKS";
    barracksBtn.onclick = () => this.onBarracks();
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

  private renderMap(container: HTMLElement, state: CampaignState) {
    const nodes = state.nodes;
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
      const isCurrent = state.currentNodeId === node.id;
      const nodeEl = document.createElement("div");
      nodeEl.className = `campaign-node ${node.status.toLowerCase()}`;
      if (isCurrent) nodeEl.className += " current";
      nodeEl.dataset.id = node.id;
      nodeEl.style.position = "absolute";
      nodeEl.style.left = `${node.position.x + 100}px`;
      nodeEl.style.top = `${node.position.y + 100}px`;
      nodeEl.style.width = "44px";
      nodeEl.style.height = "44px";
      nodeEl.style.borderRadius = "4px"; // Square-ish for sci-fi look
      nodeEl.style.border = "1px solid #444";
      nodeEl.style.display = "flex";
      nodeEl.style.alignItems = "center";
      nodeEl.style.justifyContent = "center";
      nodeEl.style.cursor = "pointer";
      nodeEl.style.transition = "all 0.2s";
      nodeEl.style.zIndex = "2";
      nodeEl.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
      const statusText = node.status === "Revealed" ? "Locked" : node.status;
      nodeEl.title = `${node.type} (${statusText}) - Difficulty: ${node.difficulty.toFixed(1)}`;

      // Visuals based on status
      switch (node.status) {
        case "Hidden":
          nodeEl.style.opacity = "0";
          nodeEl.style.pointerEvents = "none";
          break;
        case "Revealed":
          nodeEl.style.opacity = "0.4";
          nodeEl.style.borderColor = "#333";
          nodeEl.style.cursor = "default";
          break;
        case "Accessible":
          nodeEl.style.borderColor = "#0f0";
          nodeEl.style.boxShadow =
            "inset 0 0 10px rgba(0, 255, 0, 0.3), 0 0 15px rgba(0, 255, 0, 0.2)";
          nodeEl.onclick = () => this.onNodeSelect(node);
          break;
        case "Cleared":
          nodeEl.style.borderColor = "#080";
          nodeEl.style.background = "rgba(0, 80, 0, 0.4)";
          nodeEl.style.cursor = "default";
          break;
      }

      if (isCurrent) {
        nodeEl.style.borderColor = "#0af";
        nodeEl.style.boxShadow =
          "inset 0 0 15px rgba(0, 170, 255, 0.4), 0 0 20px rgba(0, 170, 255, 0.3)";
      }

      // Icon/Text
      const icon = document.createElement("span");
      icon.style.fontSize = "1.2em";
      icon.style.filter = "drop-shadow(0 0 2px currentColor)";
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

      // Current Indicator (Ship Icon)
      if (isCurrent) {
        const indicator = document.createElement("div");
        indicator.textContent = "▲";
        indicator.style.position = "absolute";
        indicator.style.top = "-20px";
        indicator.style.color = "#0af";
        indicator.style.fontSize = "1.2em";
        indicator.style.textShadow = "0 0 5px #0af";
        nodeEl.appendChild(indicator);
      }

      container.appendChild(nodeEl);
    });

    // Resize observer for canvas
    const ro = new ResizeObserver(() => {
      canvas.width = container.scrollWidth;
      canvas.height = container.scrollHeight;
      this.drawConnections(canvas, nodes);
    });
    ro.observe(container);
    // Initial call after a tick to ensure layout
    setTimeout(() => {
      canvas.width = container.scrollWidth;
      canvas.height = container.scrollHeight;
      this.drawConnections(canvas, nodes);
    }, 0);
  }

  private drawConnections(canvas: HTMLCanvasElement, nodes: CampaignNode[]) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    nodes.forEach((node) => {
      if (node.status === "Hidden") return;

      node.connections.forEach((connId) => {
        const target = nodes.find((n) => n.id === connId);
        if (target && target.status !== "Hidden") {
          ctx.beginPath();
          // Center of 44x44 node is +22. Added to 100 padding = 122.
          ctx.moveTo(node.position.x + 122, node.position.y + 122);
          ctx.lineTo(target.position.x + 122, target.position.y + 122);

          if (
            node.status === "Cleared" &&
            (target.status === "Accessible" || target.status === "Cleared")
          ) {
            ctx.strokeStyle = "rgba(0, 255, 0, 0.4)";
            ctx.setLineDash([]);
            ctx.lineWidth = 2;
          } else {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1;
          }

          ctx.stroke();
        }
      });
    });
  }
}
