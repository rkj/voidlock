import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { ConfigManager } from "@src/renderer/ConfigManager";
import { CampaignNode, CampaignState } from "@src/shared/campaign_types";
import { ModalService } from "../ui/ModalService";
import { NewCampaignWizard } from "./campaign/NewCampaignWizard";
import { AppContext } from "../app/AppContext";
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
    context: AppContext,
    onNodeSelect: (node: CampaignNode) => void,
    onBack: () => void,
    onCampaignStart?: () => void,
    onShowSummary?: () => void,
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.manager = context.campaignManager;
    this.modalService = context.modalService;
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
        { key: "Arrows", label: "Navigate", description: "Move selection", category: "Navigation" },
        { key: "Enter", label: "Select", description: "Activate node/button", category: "Navigation" },
      ],
    });
  }

  private handleKeyDown(e: KeyboardEvent): boolean {
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
      return UIUtils.handleArrowNavigation(e, this.container);
    }
    return false;
  }

  private render() {
    this.container.innerHTML = "";
    this.container.className =
      "screen campaign-screen flex-col relative h-full w-full";
    this.container.style.display = "flex";
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
        (btn as HTMLElement).onclick = () => {
          if (this.onShowSummary) this.onShowSummary();
        };
      return;
    }

    if (state.status === "Defeat") {
      this.container.innerHTML = `<div class="flex-col align-center justify-center h-full">
        <h1 style="color:var(--color-error)">Campaign Defeat</h1>
        <button class="primary-button" style="background-color:var(--color-error); height: 32px; padding: 0 30px; display: flex; align-items: center; font-size: 0.9em;" id="btn-defeat-summary">View Summary</button>
      </div>`;
      const btn = this.container.querySelector("#btn-defeat-summary");
      if (btn)
        (btn as HTMLElement).onclick = () => {
          if (this.onShowSummary) this.onShowSummary();
        };
      return;
    }

    // Map Viewport
    const viewport = document.createElement("div");
    viewport.className = "campaign-map-viewport";

    // Scanline effect
    const scanline = document.createElement("div");
    scanline.className = "scanline";
    viewport.appendChild(scanline);

    this.renderMap(viewport, state);
    this.container.appendChild(viewport);

    // Abandon Campaign button (Subtle, in the corner)
    const abandonBtn = document.createElement("button");
    abandonBtn.textContent = "Abandon Campaign";
    abandonBtn.className = "back-button";
    abandonBtn.style.position = "absolute";
    abandonBtn.style.bottom = "40px"; // Moved up to avoid meta-stats footer
    abandonBtn.style.right = "20px";
    abandonBtn.style.fontSize = "0.75em";
    abandonBtn.style.height = "32px";
    abandonBtn.style.display = "flex";
    abandonBtn.style.alignItems = "center";
    abandonBtn.style.opacity = "0.6";
    abandonBtn.style.margin = "0";
    abandonBtn.style.color = "var(--color-error)";
    abandonBtn.onclick = async () => {
      if (
        await this.modalService.confirm(
          "Are you sure you want to abandon the current campaign?",
        )
      ) {
        ConfigManager.clearCampaign();
        this.manager.reset();
        this.onBack();
      }
    };
    this.container.appendChild(abandonBtn);
  }

  private renderNoCampaign() {
    if (!this.wizard) {
      this.wizard = new NewCampaignWizard(this.container, {
        onStartCampaign: (seed, difficulty, overrides) => {
          this.manager.startNewCampaign(seed, difficulty, overrides);
          if (this.onCampaignStart) this.onCampaignStart();
          this.render();
        },
        onBack: () => this.onBack(),
      });
    }
    this.wizard.render();
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
      nodeEl.tabIndex = 0; // Make focusable

      const statusText =
        node.status === "Revealed"
          ? "Locked"
          : node.status === "Skipped"
            ? "Skipped"
            : node.status;
      nodeEl.title = `${node.type} (${statusText}) - Difficulty: ${node.difficulty.toFixed(1)}`;

      if (node.status === "Accessible") {
        nodeEl.onclick = () => this.onNodeSelect(node);
        nodeEl.onkeydown = (e) => {
          if (e.key === "Enter" || e.key === " ") {
            this.onNodeSelect(node);
            e.preventDefault();
            e.stopPropagation();
          }
        };
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

      // Bonus Loot Pips (Intel)
      const showLootIntel =
        state.rules.difficulty === "Simulation" ||
        state.rules.difficulty === "Clone";
      if (showLootIntel && node.bonusLootCount > 0) {
        const pipsContainer = document.createElement("div");
        pipsContainer.className = "pips-container flex-row justify-center";
        pipsContainer.title = `Bonus Loot: ${node.bonusLootCount} crate${node.bonusLootCount > 1 ? "s" : ""}`;
        pipsContainer.style.position = "absolute";
        pipsContainer.style.bottom = "-12px";
        pipsContainer.style.width = "100%";
        pipsContainer.style.gap = "2px";
        pipsContainer.style.pointerEvents = "none";

        for (let i = 0; i < node.bonusLootCount; i++) {
          const pip = document.createElement("span");
          pip.className = "loot-pip";
          pip.textContent = "📦";
          pip.style.fontSize = "0.7em";
          pip.style.color = "var(--color-warning)";
          pip.style.textShadow = "0 0 3px rgba(255, 152, 0, 0.5)";
          pipsContainer.appendChild(pip);
        }
        nodeEl.appendChild(pipsContainer);
      }

      // Current Indicator (Ship Icon)
      if (isCurrent) {
        const indicator = document.createElement("div");
        indicator.textContent = "▼";
        indicator.style.position = "absolute";
        indicator.style.top = "-22px";
        indicator.style.left = "50%";
        indicator.style.transform = "translateX(-50%)";
        indicator.style.color = "var(--color-accent)";
        indicator.style.fontSize = "1.4em";
        indicator.style.textShadow = "0 0 8px var(--color-accent)";
        indicator.style.zIndex = "10";
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
