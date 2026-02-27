import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { ConfigManager } from "@src/renderer/ConfigManager";
import { CampaignNode, CampaignState } from "@src/shared/campaign_types";
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
    canvas.style.zIndex = "6";
    container.appendChild(canvas);

    const currentId = state.currentNodeId;
    const currentNode = currentId ? nodes.find((n) => n.id === currentId) : null;

    // Nodes
    nodes.forEach((node) => {
      const isCurrent = currentId === node.id;

      // Focus restriction: Only the current node and its direct connections are focusable
      // (as per docs/spec/campaign.md#3-1-the-sector-map)
      const isNextNode = currentNode
        ? currentNode.connections.includes(node.id) &&
          node.status === "Accessible"
        : node.status === "Accessible";
      const isFocusable = isCurrent || isNextNode;

      const nodeEl = document.createElement("div");
      nodeEl.className = `campaign-node ${node.status.toLowerCase()}`;
      if (isCurrent) nodeEl.className += " current";
      nodeEl.dataset.id = node.id;
      nodeEl.style.position = "absolute";
      nodeEl.style.left = `${node.position.x + 100}px`;
      nodeEl.style.top = `${node.position.y + 100}px`;
      nodeEl.tabIndex = isFocusable ? 0 : -1;

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
      icon.style.display = "flex";
      icon.style.alignItems = "center";
      icon.style.justifyContent = "center";
      icon.style.width = "24px";
      icon.style.height = "24px";
      icon.style.filter = "drop-shadow(0 0 2px currentColor)";
      
      let svgContent = "";
      switch (node.type) {
        case "Combat":
          svgContent = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/></svg>`;
          break;
        case "Elite":
          svgContent = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 10a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/><path d="M17 10a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/><path d="M12 2a8 8 0 0 0-8 8c0 4.42 3.58 8 8 8s8-3.58 8-8a8 8 0 0 0-8-8z"/><path d="M10 18v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2"/></svg>`;
          break;
        case "Shop":
          svgContent = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6v4"/><path d="M17 14v4"/></svg>`;
          break;
        case "Event":
          svgContent = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
          break;
        case "Boss":
          svgContent = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3c3 6 1 12 1 12"/><path d="M21 3c-3 6-1 12-1 12"/><circle cx="12" cy="14" r="6"/></svg>`;
          break;
      }
      icon.innerHTML = svgContent;
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
        pipsContainer.style.zIndex = "11";

        for (let i = 0; i < node.bonusLootCount; i++) {
          const pip = document.createElement("span");
          pip.className = "loot-pip";
          pip.style.display = "flex";
          pip.style.width = "12px";
          pip.style.height = "12px";
          pip.innerHTML = `<svg viewBox="0 0 24 24" fill="var(--color-warning)" stroke="none"><path d="M21 8l-9-4-9 4v8l9 4 9-4V8z"/><path d="M3 8l9 4 9-4"/><path d="M12 20V12"/></svg>`;
          pip.style.filter = "drop-shadow(0 0 3px rgba(255, 152, 0, 0.5))";
          pipsContainer.appendChild(pip);
        }
        nodeEl.appendChild(pipsContainer);
      }

      // Current Indicator (Ship Icon)
      if (isCurrent) {
        const indicator = document.createElement("div");
        indicator.style.position = "absolute";
        indicator.style.top = "-22px";
        indicator.style.left = "50%";
        indicator.style.transform = "translateX(-50%)";
        indicator.style.width = "20px";
        indicator.style.height = "20px";
        indicator.style.color = "var(--color-accent)";
        indicator.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 21l-12-18h24z"/></svg>`;
        indicator.style.filter = "drop-shadow(0 0 8px var(--color-accent))";
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
            ctx.strokeStyle = "#FFFFFF";
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
