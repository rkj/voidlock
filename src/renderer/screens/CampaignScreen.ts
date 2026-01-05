import { CampaignManager } from "../campaign/CampaignManager";
import { CampaignNode, CampaignState } from "../../shared/campaign_types";

export class CampaignScreen {
  private container: HTMLElement;
  private manager: CampaignManager;
  private onNodeSelect: (node: CampaignNode) => void;
  private onBarracks: () => void;
  private onBack: () => void;
  private onCampaignStart?: () => void;

  constructor(
    containerId: string,
    manager: CampaignManager,
    onNodeSelect: (node: CampaignNode) => void,
    onBarracks: () => void,
    onBack: () => void,
    onCampaignStart?: () => void,
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.manager = manager;
    this.onNodeSelect = onNodeSelect;
    this.onBarracks = onBarracks;
    this.onBack = onBack;
    this.onCampaignStart = onCampaignStart;
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
    this.container.className =
      "screen campaign-screen flex-col relative h-full w-full";
    this.container.style.display = "flex";

    const state = this.manager.getState();
    if (!state) {
      this.renderNoCampaign();
      return;
    }

    // Header
    const header = document.createElement("div");
    header.className = "flex-row justify-between align-center p-20";
    header.style.borderBottom = "1px solid var(--color-border-strong)";
    header.style.background = "var(--color-surface-elevated)";

    const title = document.createElement("h1");
    title.textContent = "SECTOR MAP";
    title.style.margin = "0";
    title.style.fontSize = "1.5em";
    header.appendChild(title);

    const stats = document.createElement("div");
    stats.className = "flex-row gap-20";
    stats.innerHTML = `
      <span>SCRAP: <span style="color:var(--color-primary)">${state.scrap}</span></span>
      <span>INTEL: <span style="color:var(--color-accent)">${state.intel}</span></span>
      <span>SECTOR: <span style="color:var(--color-text)">${state.currentSector}</span></span>
    `;
    header.appendChild(stats);

    this.container.appendChild(header);

    // Map Viewport
    const viewport = document.createElement("div");
    viewport.className = "campaign-map-viewport";

    // Scanline effect
    const scanline = document.createElement("div");
    scanline.className = "scanline";
    viewport.appendChild(scanline);

    this.renderMap(viewport, state);
    this.container.appendChild(viewport);

    // Footer
    const footer = document.createElement("div");
    footer.className = "flex-row justify-between p-20";
    footer.style.borderTop = "1px solid var(--color-border-strong)";
    footer.style.background = "var(--color-surface-elevated)";

    const backBtn = document.createElement("button");
    backBtn.textContent = "BACK TO MENU";
    backBtn.className = "back-button";
    backBtn.onclick = () => this.onBack();
    footer.appendChild(backBtn);

    const resetBtn = document.createElement("button");
    resetBtn.textContent = "NEW CAMPAIGN";
    resetBtn.style.color = "var(--color-error)";
    resetBtn.onclick = () => {
      if (confirm("Are you sure you want to abandon the current campaign?")) {
        this.manager.reset();
        this.onBack();
      }
    };
    footer.appendChild(resetBtn);

    const barracksBtn = document.createElement("button");
    barracksBtn.textContent = "BARRACKS";
    barracksBtn.onclick = () => this.onBarracks();
    footer.appendChild(barracksBtn);

    this.container.appendChild(footer);
  }

  private renderNoCampaign() {
    const content = document.createElement("div");
    content.className =
      "flex-col align-center justify-center h-full gap-20 campaign-setup-wizard";
    content.style.maxWidth = "400px";
    content.style.margin = "0 auto";

    const h1 = document.createElement("h1");
    h1.textContent = "NEW CAMPAIGN";
    h1.style.letterSpacing = "4px";
    h1.style.color = "var(--color-primary)";
    content.appendChild(h1);

    const form = document.createElement("div");
    form.className = "flex-col gap-20 w-full p-20";
    form.style.background = "var(--color-surface-elevated)";
    form.style.border = "1px solid var(--color-border-strong)";

    // Difficulty
    const diffGroup = document.createElement("div");
    diffGroup.className = "flex-col gap-5";
    const diffLabel = document.createElement("label");
    diffLabel.textContent = "DIFFICULTY";
    diffLabel.style.fontSize = "0.8em";
    diffLabel.style.color = "var(--color-text-dim)";
    const diffSelect = document.createElement("select");
    diffSelect.id = "campaign-difficulty";
    diffSelect.innerHTML = `
      <option value="easy">SIMULATION (Easy)</option>
      <option value="normal" selected>CLONE (Normal)</option>
      <option value="hard">STANDARD (Hard)</option>
      <option value="extreme">IRONMAN (Extreme)</option>
    `;
    diffGroup.appendChild(diffLabel);
    diffGroup.appendChild(diffSelect);
    form.appendChild(diffGroup);

    // Tactical Pause
    const pauseGroup = document.createElement("div");
    pauseGroup.className = "flex-row align-center gap-10";
    const pauseCheck = document.createElement("input");
    pauseCheck.type = "checkbox";
    pauseCheck.id = "campaign-tactical-pause";
    pauseCheck.checked = true;
    const pauseLabel = document.createElement("label");
    pauseLabel.htmlFor = "campaign-tactical-pause";
    pauseLabel.textContent = "Allow Tactical Pause (0.1x)";
    pauseLabel.style.fontSize = "0.9em";
    pauseGroup.appendChild(pauseCheck);
    pauseGroup.appendChild(pauseLabel);
    form.appendChild(pauseGroup);

    // Theme Selection
    const themeGroup = document.createElement("div");
    themeGroup.className = "flex-col gap-5";
    const themeLabel = document.createElement("label");
    themeLabel.textContent = "VISUAL THEME";
    themeLabel.style.fontSize = "0.8em";
    themeLabel.style.color = "var(--color-text-dim)";
    const themeSelect = document.createElement("select");
    themeSelect.id = "campaign-theme";
    themeSelect.innerHTML = `
      <option value="default" selected>DEFAULT (Voidlock Green)</option>
      <option value="industrial">INDUSTRIAL (Amber/Steel)</option>
      <option value="hive">ALIEN HIVE (Purple/Biolume)</option>
    `;
    themeGroup.appendChild(themeLabel);
    themeGroup.appendChild(themeSelect);
    form.appendChild(themeGroup);

    // Update pause checkbox based on difficulty
    diffSelect.addEventListener("change", () => {
      if (diffSelect.value === "extreme") {
        pauseCheck.checked = false;
        pauseCheck.disabled = true;
      } else {
        pauseCheck.disabled = false;
        if (diffSelect.value === "easy" || diffSelect.value === "normal") {
          pauseCheck.checked = true;
        }
      }
    });

    content.appendChild(form);

    const startBtn = document.createElement("button");
    startBtn.textContent = "INITIALIZE EXPEDITION";
    startBtn.className = "primary-button w-full";
    startBtn.onclick = () => {
      this.manager.startNewCampaign(
        Date.now(),
        diffSelect.value,
        pauseCheck.checked,
        themeSelect.value,
      );
      if (this.onCampaignStart) this.onCampaignStart();
      this.render();
    };
    content.appendChild(startBtn);

    const backBtn = document.createElement("button");
    backBtn.textContent = "BACK TO MENU";
    backBtn.className = "back-button w-full";
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

      const statusText = node.status === "Revealed" ? "Locked" : node.status;
      nodeEl.title = `${node.type} (${statusText}) - Difficulty: ${node.difficulty.toFixed(1)}`;

      if (node.status === "Accessible") {
        nodeEl.onclick = () => this.onNodeSelect(node);
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
        indicator.style.color = "var(--color-accent)";
        indicator.style.fontSize = "1.2em";
        indicator.style.textShadow = "0 0 5px var(--color-accent)";
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
            ctx.strokeStyle = "var(--color-los-soldier)";
            ctx.setLineDash([]);
            ctx.lineWidth = 2;
          } else {
            ctx.strokeStyle = "var(--color-text-dim)";
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1;
          }

          ctx.stroke();
        }
      });
    });
  }
}
