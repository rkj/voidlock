import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { CampaignNode, CampaignState } from "@src/shared/campaign_types";
import { ThemeManager } from "@src/renderer/ThemeManager";
import { ModalService } from "../ui/ModalService";
import { NewCampaignWizard } from "./campaign/NewCampaignWizard";
import { InputDispatcher } from "../InputDispatcher";
import { InputPriority } from "@src/shared/types";
import { UIUtils } from "../utils/UIUtils";

export class CampaignScreen {
  private container: HTMLElement;
  private manager: CampaignManager;
  private modalService: ModalService;
  private onNodeSelect: (node: CampaignNode) => void;
  private onBack: () => void;
  private onCampaignStart?: () => void;
  private onShowSummary?: () => void;
  private wizard: NewCampaignWizard | null = null;

  constructor(
    containerId: string,
    campaignManager: CampaignManager,
    modalService: ModalService,
    onNodeSelect: (node: CampaignNode) => void,
    onBack: () => void,
    onCampaignStart?: () => void,
    onShowSummary?: () => void,
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.manager = campaignManager;
    this.modalService = modalService;
    this.onNodeSelect = onNodeSelect;
    this.onBack = onBack;
    this.onCampaignStart = onCampaignStart;
    this.onShowSummary = onShowSummary;
  }

  public show() {
    this.container.style.display = "flex";
    this.render();
    this.pushInputContext();
  }

  public hide() {
    this.container.style.display = "none";
    InputDispatcher.getInstance().popContext("campaign");
  }

  private pushInputContext() {
    InputDispatcher.getInstance().pushContext({
      id: "campaign",
      priority: InputPriority.UI,
      trapsFocus: true,
      container: this.container,
      handleKeyDown: (e) => this.handleKeyDown(e),
      getShortcuts: () => [
        {
          key: "Arrows",
          label: "Navigate",
          description: "Move selection",
          category: "Navigation",
        },
        {
          key: "Enter",
          label: "Select",
          description: "Activate node/button",
          category: "Navigation",
        },
      ],
    });
  }

  private handleKeyDown(e: KeyboardEvent): boolean {
    if (
      e.key === "ArrowDown" ||
      e.key === "ArrowUp" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight"
    ) {
      return UIUtils.handleArrowNavigation(e, this.container);
    }
    return false;
  }

  private render() {
    this.container.innerHTML = "";
    this.container.className =
      "screen campaign-screen flex-col relative h-full w-full";
    this.container.style.overflowY = "hidden";

    const state = this.manager.getState();
    if (!state) {
      this.renderNoCampaign();
      return;
    }

    if (state.status === "Victory") {
      this.container.innerHTML = `<div class="flex-col align-center justify-center h-full">
        <h1 style="color:var(--color-primary)">Campaign Victory</h1>
        <button class="primary-button" id="btn-victory-summary" style="height: 32px; padding: 0 30px; display: flex; align-items: center; font-size: 0.9em;">View Summary</button>
      </div>`;
      const btn = this.container.querySelector("#btn-victory-summary");
      if (btn)
        btn.addEventListener("click", () => {
          if (this.onShowSummary) this.onShowSummary();
        });
      return;
    }

    if (state.status === "Defeat") {
      this.container.innerHTML = `<div class="flex-col align-center justify-center h-full">
        <h1 style="color:var(--color-error)">Campaign Defeat</h1>
        <button class="primary-button" style="background-color:var(--color-error); height: 32px; padding: 0 30px; display: flex; align-items: center; font-size: 0.9em;" id="btn-defeat-summary">View Summary</button>
      </div>`;
      const btn = this.container.querySelector("#btn-defeat-summary");
      if (btn)
        btn.addEventListener("click", () => {
          if (this.onShowSummary) this.onShowSummary();
        });
      return;
    }

    // Map Viewport
    const viewport = document.createElement("div");
    viewport.className = "campaign-map-viewport";

    // Dynamic background from manifest
    const bgUrl = ThemeManager.getInstance().getAssetUrl("bg_station");
    if (bgUrl) {
      viewport.style.setProperty("--campaign-bg", `url("${bgUrl}")`);
    }

    // Grain effect
    const grain = document.createElement("div");
    grain.className = "grain";
    viewport.appendChild(grain);

    // Scanline effect
    const scanline = document.createElement("div");
    scanline.className = "scanline";
    viewport.appendChild(scanline);

    this.renderMap(viewport, state);
    this.container.appendChild(viewport);

    // Abandon Campaign button (Subtle, in the corner)
    const abandonBtn = document.createElement("button");
    abandonBtn.textContent = "Abandon Campaign";
    abandonBtn.className = "text-button abandon-button";
    abandonBtn.style.position = "absolute";
    abandonBtn.style.bottom = "20px";
    abandonBtn.style.right = "20px";
    abandonBtn.style.fontSize = "0.7em";
    abandonBtn.style.opacity = "0.5";
    abandonBtn.addEventListener("click", async () => {
      if (
        await this.modalService.confirm(
          "Are you sure you want to abandon this campaign? All progress will be lost.",
        )
      ) {
        this.manager.deleteSave();
        this.render();
      }
    });
    this.container.appendChild(abandonBtn);
  }

  private renderNoCampaign() {
    this.wizard = new NewCampaignWizard(this.container, {
      onStartCampaign: (seed, difficulty, overrides) => {
        this.manager.startNewCampaign(seed, difficulty, overrides);
        if (this.onCampaignStart) this.onCampaignStart();
        this.render();
      },
      onBack: () => this.onBack(),
    });
    this.wizard.render();
  }

  private renderMap(container: HTMLElement, state: CampaignState) {
    const nodes = state.nodes;
    // Canvas for connections
    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.zIndex = "5"; // Below nodes
    canvas.style.pointerEvents = "none";
    container.appendChild(canvas);

    // Initial call after a tick to ensure layout
    setTimeout(() => {
      canvas.width = container.scrollWidth;
      canvas.height = container.scrollHeight;
      this.drawConnections(canvas, nodes);
    }, 0);

    nodes.forEach((node) => {
      const isCurrent = state.currentNodeId === node.id;
      const nodeEl = document.createElement("div");
      nodeEl.className = `campaign-node ${node.status.toLowerCase()}`;
      if (isCurrent) nodeEl.classList.add("current");
      
      nodeEl.style.left = `${node.position.x}px`;
      nodeEl.style.top = `${node.position.y}px`;
      nodeEl.dataset.id = node.id;
      nodeEl.title = `${node.type} Mission (Diff ${node.difficulty})`;
      nodeEl.tabIndex = node.status === "Accessible" ? 0 : -1;

      // Icon based on type
      const icon = document.createElement("div");
      icon.className = "node-icon";
      icon.innerHTML = this.getNodeIcon(node.type);
      nodeEl.appendChild(icon);

      // Rank Label
      const label = document.createElement("div");
      label.className = "node-label";
      label.textContent = `Rank ${node.rank}`;
      nodeEl.appendChild(label);

      // Current Indicator
      if (isCurrent) {
        const indicator = document.createElement("div");
        indicator.style.position = "absolute";
        indicator.style.top = "-22px";
        indicator.style.left = "50%";
        indicator.style.transform = "translateX(-50%)";
        indicator.style.width = "20px";
        indicator.style.height = "20px";
        indicator.style.color = "var(--color-accent)";
        indicator.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 21l-12-18h24z"/></svg>';
        indicator.style.filter = "drop-shadow(0 0 8px var(--color-accent))";
        indicator.style.zIndex = "10";
        nodeEl.appendChild(indicator);
      }

      // Bonus Loot Pips
      if ((state.rules.difficulty === "Simulation" || state.rules.difficulty === "Clone") && node.bonusLootCount > 0) {
        const pipsContainer = document.createElement("div");
        pipsContainer.className = "pips-container flex-row justify-center";
        pipsContainer.title = `Bonus Loot: ${node.bonusLootCount} crate${node.bonusLootCount > 1 ? "s" : ""}`;
        pipsContainer.style.position = "absolute";
        pipsContainer.style.bottom = "-12px";
        pipsContainer.style.width = "100%";
        pipsContainer.style.gap = "2px";
        pipsContainer.style.pointerEvents = "none";
        pipsContainer.style.zIndex = "11";

        for (let i = 0; i < node.bonusLootCount; i++) {
          const pip = document.createElement("span");
          pip.className = "loot-pip";
          pip.style.display = "flex";
          pip.style.width = "12px";
          pip.style.height = "12px";
          pip.innerHTML = '<svg viewBox="0 0 24 24" fill="var(--color-warning)" stroke="none"><path d="M21 8l-9-4-9 4v8l9 4 9-4V8z"/><path d="M3 8l9 4 9-4"/><path d="M12 20V12"/></svg>';
          pip.style.filter = "drop-shadow(0 0 3px rgba(255, 152, 0, 0.5))";
          pipsContainer.appendChild(pip);
        }
        nodeEl.appendChild(pipsContainer);
      }

      if (node.status === "Accessible") {
        nodeEl.addEventListener("click", () => this.onNodeSelect(node));
        nodeEl.onkeydown = (e) => {
          if (e.key === "Enter" || e.key === " ") {
            this.onNodeSelect(node);
            e.preventDefault();
          }
        };
      }

      container.appendChild(nodeEl);
    });
  }

  private getNodeIcon(type: string): string {
    switch (type) {
      case "Combat":
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>';
      case "Elite":
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
      case "Boss":
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>';
      case "Shop":
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6zM3 6h18M16 10a4 4 0 01-8 0"/></svg>';
      case "Event":
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/></svg>';
      default:
        return "?";
    }
  }

  private drawConnections(canvas: HTMLCanvasElement, nodes: CampaignNode[]) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    nodes.forEach((node) => {
      node.connections.forEach((connId) => {
        const target = nodes.find((n) => n.id === connId);
        if (target) {
          ctx.beginPath();
          ctx.moveTo(node.position.x + 20, node.position.y + 20);
          ctx.lineTo(target.position.x + 20, target.position.y + 20);

          if (node.status === "Cleared" && target.status === "Accessible") {
            ctx.strokeStyle = "#FFFFFF"; // High contrast for active path
            ctx.setLineDash([]);
            ctx.lineWidth = 2;
          } else if (node.status === "Cleared" && target.status === "Cleared") {
            ctx.strokeStyle = "var(--color-primary)";
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
