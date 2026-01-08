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

    if (state.status === "Defeat") {
      this.renderGameOver();
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
    form.style.minWidth = "800px";

    // Difficulty Cards
    const diffLabel = document.createElement("label");
    diffLabel.textContent = "SELECT DIFFICULTY";
    diffLabel.style.fontSize = "0.8em";
    diffLabel.style.color = "var(--color-text-dim)";
    diffLabel.style.marginBottom = "-10px";
    form.appendChild(diffLabel);

    const cardsContainer = document.createElement("div");
    cardsContainer.className = "flex-row gap-10 w-full";
    cardsContainer.style.justifyContent = "space-between";

    let selectedDifficulty = "normal";

    const DIFFICULTIES = [
      {
        id: "easy",
        name: "SIMULATION",
        rules: ["Permadeath: OFF", "Save: Manual", "Pause: ALLOWED"],
      },
      {
        id: "normal",
        name: "CLONE",
        rules: ["Permadeath: PARTIAL (Cloneable)", "Save: Manual", "Pause: ALLOWED"],
      },
      {
        id: "hard",
        name: "STANDARD",
        rules: ["Permadeath: ON", "Save: Manual", "Pause: ALLOWED"],
      },
      {
        id: "extreme",
        name: "IRONMAN",
        rules: ["Permadeath: ON", "Save: Auto-Delete", "Pause: DISABLED"],
      },
    ];

    const cards: HTMLElement[] = [];

    // Tactical Pause (needed early for card click logic)
    const pauseGroup = document.createElement("div");
    pauseGroup.className = "flex-row align-center gap-10";
    const pauseCheck = document.createElement("input");
    pauseCheck.type = "checkbox";
    pauseCheck.id = "campaign-tactical-pause";
    pauseCheck.checked = true;
    const pauseLabel = document.createElement("label");
    pauseLabel.htmlFor = "campaign-tactical-pause";
    pauseLabel.textContent = "Allow Tactical Pause (0.05x)";
    pauseLabel.style.fontSize = "0.9em";
    pauseGroup.appendChild(pauseCheck);
    pauseGroup.appendChild(pauseLabel);

    DIFFICULTIES.forEach((diff) => {
      const card = document.createElement("div");
      card.className = "difficulty-card flex-col gap-10 p-15 flex-1";
      card.style.border = "1px solid var(--color-border-strong)";
      card.style.background = "rgba(255, 255, 255, 0.05)";
      card.style.cursor = "pointer";
      card.style.transition = "all 0.2s ease";

      const title = document.createElement("h3");
      title.textContent = diff.name;
      title.style.margin = "0";
      title.style.color = "var(--color-text)";
      card.appendChild(title);

      const rulesList = document.createElement("ul");
      rulesList.style.margin = "0";
      rulesList.style.paddingLeft = "15px";
      rulesList.style.fontSize = "0.8em";
      rulesList.style.color = "var(--color-text-dim)";
      diff.rules.forEach((rule) => {
        const li = document.createElement("li");
        li.textContent = rule;
        rulesList.appendChild(li);
      });
      card.appendChild(rulesList);

      if (diff.id === selectedDifficulty) {
        card.classList.add("selected");
        card.style.borderColor = "var(--color-primary)";
        card.style.background = "rgba(var(--color-primary-rgb), 0.1)";
        title.style.color = "var(--color-primary)";
      }

      card.onclick = () => {
        selectedDifficulty = diff.id;
        cards.forEach((c) => {
          c.classList.remove("selected");
          c.style.borderColor = "var(--color-border-strong)";
          c.style.background = "rgba(255, 255, 255, 0.05)";
          (c.querySelector("h3") as HTMLElement).style.color = "var(--color-text)";
        });
        card.classList.add("selected");
        card.style.borderColor = "var(--color-primary)";
        card.style.background = "rgba(var(--color-primary-rgb), 0.1)";
        title.style.color = "var(--color-primary)";

        // Ironman logic
        if (selectedDifficulty === "extreme") {
          pauseCheck.checked = false;
          pauseCheck.disabled = true;
          const tooltip = "Tactical Pause is disabled in Ironman mode.";
          pauseCheck.title = tooltip;
          pauseLabel.title = tooltip;
          pauseLabel.style.opacity = "0.5";
        } else {
          pauseCheck.disabled = false;
          pauseCheck.title = "";
          pauseLabel.title = "";
          pauseLabel.style.opacity = "1";
          if (
            selectedDifficulty === "easy" ||
            selectedDifficulty === "normal" ||
            selectedDifficulty === "hard"
          ) {
            pauseCheck.checked = true;
          }
        }
      };

      cards.push(card);
      cardsContainer.appendChild(card);
    });

    form.appendChild(cardsContainer);
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

    content.appendChild(form);

    const startBtn = document.createElement("button");
    startBtn.textContent = "INITIALIZE EXPEDITION";
    startBtn.className = "primary-button w-full";
    startBtn.onclick = () => {
      this.manager.startNewCampaign(
        Date.now(),
        selectedDifficulty,
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

  private renderGameOver() {
    const content = document.createElement("div");
    content.className =
      "flex-col align-center justify-center h-full gap-40 campaign-game-over";
    content.style.background = "rgba(0,0,0,0.85)";
    content.style.position = "absolute";
    content.style.inset = "0";
    content.style.zIndex = "100";

    const h1 = document.createElement("h1");
    h1.textContent = "MISSION FAILED";
    h1.style.color = "var(--color-error)";
    h1.style.fontSize = "3em";
    h1.style.letterSpacing = "8px";
    h1.style.margin = "0";
    content.appendChild(h1);

    const sub = document.createElement("h2");
    sub.textContent = "CAMPAIGN OVER";
    sub.style.color = "var(--color-text-dim)";
    sub.style.letterSpacing = "4px";
    sub.style.margin = "0";
    content.appendChild(sub);

    const backBtn = document.createElement("button");
    backBtn.textContent = "RETURN TO MENU";
    backBtn.className = "primary-button";
    backBtn.style.minWidth = "200px";
    backBtn.onclick = () => {
      this.manager.deleteSave();
      this.onBack();
    };
    content.appendChild(backBtn);

    this.container.appendChild(content);
  }
}
