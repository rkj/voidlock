import type { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import type { CampaignNode, CampaignState } from "@src/shared/campaign_types";
import { ThemeManager } from "@src/renderer/ThemeManager";
import type { ModalService } from "../ui/ModalService";
import { NewCampaignWizard } from "./campaign/NewCampaignWizard";
import { InputDispatcher } from "../InputDispatcher";
import { InputPriority } from "@src/shared/types";
import { UIUtils } from "../utils/UIUtils";

export interface CampaignScreenConfig {
  containerId: string;
  campaignManager: CampaignManager;
  themeManager: ThemeManager;
  inputDispatcher: InputDispatcher;
  modalService: ModalService;
  onNodeSelect: (node: CampaignNode) => void;
  onMainMenu: () => void;
  onCampaignStart?: () => void;
  onShowSummary?: () => void;
}

export class CampaignScreen {
  private container: HTMLElement;
  private manager: CampaignManager;
  private themeManager: ThemeManager;
  private inputDispatcher: InputDispatcher;
  private modalService: ModalService;
  private onNodeSelect: (node: CampaignNode) => void;
  private onMainMenu: () => void;
  private onCampaignStart?: () => void;
  private onShowSummary?: () => void;
  private wizard: NewCampaignWizard | null = null;

  constructor(config: CampaignScreenConfig) {
    const {
      containerId,
      campaignManager,
      themeManager,
      inputDispatcher,
      modalService,
      onNodeSelect,
      onMainMenu,
      onCampaignStart,
      onShowSummary,
    } = config;

    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.manager = campaignManager;
    this.themeManager = themeManager;
    this.inputDispatcher = inputDispatcher;
    this.modalService = modalService;
    this.onNodeSelect = onNodeSelect;
    this.onMainMenu = onMainMenu;
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
    this.inputDispatcher.popContext("campaign");
  }

  private pushInputContext() {
    this.inputDispatcher.pushContext({
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
        <h1 style="color:var(--color-primary)">CONTRACT SUCCESS</h1>
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
        <h1 style="color:var(--color-error)">CONTRACT TERMINATED</h1>
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
    const bgUrl = this.themeManager.getAssetUrl("bg_station");
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

    // Terminate Contract button (Subtle, in the corner)
    const abandonBtn = document.createElement("button");
    abandonBtn.textContent = "Terminate Contract";
    abandonBtn.className = "text-button abandon-button";
    abandonBtn.dataset.id = "btn-abandon";
    abandonBtn.style.position = "absolute";
    abandonBtn.style.bottom = "20px";
    abandonBtn.style.right = "20px";
    abandonBtn.style.fontSize = "0.7em";
    abandonBtn.style.opacity = "0.5";
    abandonBtn.addEventListener("click", () => {
      void (async () => {
        if (
          await this.modalService.confirm(
            "Are you sure you want to abandon this campaign? All progress will be lost.",
          )
        ) {
          this.manager.deleteSave();
          this.render();
        }
      })();
    });
    this.container.appendChild(abandonBtn);
  }

  private renderNoCampaign() {
    this.wizard = new NewCampaignWizard(this.container, {
      onStartCampaign: (seed, difficulty, overrides) => {
        this.manager.startNewCampaign({ seed, difficulty, overrides });
        if (this.onCampaignStart) this.onCampaignStart();
        this.render();
      },
      onBack: () => this.onMainMenu(),
    });
    this.wizard.render();
  }

  private renderMap(container: HTMLElement, state: CampaignState) {
    let maxY = 0;
    let maxX = 0;
    const nodes = state.nodes;
    nodes.forEach(n => { 
        if (n.position.y > maxY) maxY = n.position.y; 
        if (n.position.x > maxX) maxX = n.position.x;
    });

    // Create a wrapper for nodes to ensure scroll area expansion
    const mapContent = document.createElement("div");
    mapContent.className = "campaign-map-content";
    mapContent.style.position = "relative";
    mapContent.style.width = `${maxX + 100}px`;
    mapContent.style.height = `${maxY + 100}px`;
    container.appendChild(mapContent);

    // Canvas for connections
    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.zIndex = "5"; // Below nodes
    canvas.style.pointerEvents = "none";
    mapContent.appendChild(canvas);

    // Initial call after a tick to ensure layout
    setTimeout(() => {
      canvas.width = mapContent.scrollWidth;
      canvas.height = mapContent.scrollHeight;
      this.drawConnections(canvas, nodes);
    }, 0);

    nodes.forEach((node) => {
      mapContent.appendChild(this.createNodeElement(node, state));
    });

    // Auto-focus current node to ensure keyboard navigation starts from a known state (Spec 8.3)
    if (state.currentNodeId) {
      setTimeout(() => {
        const currentEl = mapContent.querySelector(`[data-id="${state.currentNodeId}"]`) as HTMLElement;
        if (currentEl) {
          try {
            currentEl.focus({ preventScroll: true });
          } catch {
            currentEl.focus();
          }
        }
      }, 100);
    }
  }

  private createNodeElement(node: CampaignNode, state: CampaignState): HTMLElement {
    const isCurrent = state.currentNodeId === node.id;
    const nodeEl = document.createElement("div");
    nodeEl.className = `campaign-node ${node.status.toLowerCase()}`;
    if (isCurrent) nodeEl.classList.add("current");
    nodeEl.style.left = `${node.position.x}px`;
    nodeEl.style.top = `${node.position.y}px`;
    nodeEl.dataset.id = node.id;
    nodeEl.setAttribute("data-focus-id", `campaign-node-${node.id}`);
    nodeEl.title = `${node.type} Operation (Diff ${node.difficulty})`;
    nodeEl.tabIndex = (node.status === "Accessible" || isCurrent) ? 0 : -1;

    const icon = document.createElement("div");
    icon.className = "node-icon";
    icon.appendChild(this.createNodeIcon(node.type));
    nodeEl.appendChild(icon);

    if (isCurrent) {
      const indicator = document.createElement("div");
      indicator.style.position = "absolute";
      indicator.style.top = "-22px";
      indicator.style.left = "50%";
      indicator.style.transform = "translateX(-50%)";
      indicator.style.width = "20px";
      indicator.style.height = "20px";
      indicator.style.color = "var(--color-accent)";
      indicator.appendChild(this.createSVG({ pathData: "M12 21l-12-18h24z", width: 20, height: 20 }));
      indicator.style.filter = "drop-shadow(0 0 8px var(--color-accent))";
      indicator.style.zIndex = "10";
      nodeEl.appendChild(indicator);
    }

    const showLoot = (state.rules.difficulty === "Simulation" || state.rules.difficulty === "Clone") && node.bonusLootCount > 0;
    if (showLoot) {
      nodeEl.appendChild(this.createLootPips(node.bonusLootCount));
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

    return nodeEl;
  }

  private createLootPips(count: number): HTMLElement {
    const pipsContainer = document.createElement("div");
    pipsContainer.className = "pips-container flex-row justify-center";
    pipsContainer.title = `Bonus Loot: ${count} crate${count > 1 ? "s" : ""}`;
    pipsContainer.style.position = "absolute";
    pipsContainer.style.bottom = "-12px";
    pipsContainer.style.width = "100%";
    pipsContainer.style.gap = "2px";
    pipsContainer.style.pointerEvents = "none";
    pipsContainer.style.zIndex = "11";
    for (let i = 0; i < count; i++) {
      const pip = document.createElement("span");
      pip.className = "loot-pip";
      pip.style.display = "flex";
      pip.style.width = "12px";
      pip.style.height = "12px";
      pip.appendChild(this.createLootIcon());
      pip.style.filter = "drop-shadow(0 0 3px rgba(255, 152, 0, 0.5))";
      pipsContainer.appendChild(pip);
    }
    return pipsContainer;
  }

  private createSVG(params: {
    pathData: string; width: number; height: number;
    stroke?: string; fill?: string;
  }): SVGElement {
    const { pathData, width, height, stroke = "currentColor", fill = "none" } = params;
    const svgNamespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNamespace, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", width.toString());
    svg.setAttribute("height", height.toString());
    svg.setAttribute("fill", fill);
    svg.setAttribute("stroke", stroke);
    svg.setAttribute("stroke-width", "2");

    svg.style.width = `${width}px`;
    svg.style.height = `${height}px`;
    svg.style.display = "block";

    const path = document.createElementNS(svgNamespace, "path");
    path.setAttribute("d", pathData);
    svg.appendChild(path);

    return svg;
  }

  private createNodeIcon(type: string): SVGElement | Text {
    let path = "";
    switch (type) {
      case "Combat":
        path = "M13 2L3 14h9l-1 8 10-12h-9l1-8z";
        break;
      case "Elite":
        path = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";
        break;
      case "Boss":
        path = "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5";
        break;
      case "Shop":
        path = "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6zM3 6h18M16 10a4 4 0 01-8 0";
        break;
      case "Event":
        path = "M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01";
        // Special case for Event: circle + path
        const svg = this.createSVG({ pathData: path, width: 24, height: 24 });
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", "12");
        circle.setAttribute("cy", "12");
        circle.setAttribute("r", "10");
        svg.insertBefore(circle, svg.firstChild);
        return svg;
      default:
        return document.createTextNode("?");
    }

    if (path) {
      return this.createSVG({ pathData: path, width: 24, height: 24 });
    }
    
    return document.createTextNode("?");
  }

  private createLootIcon(): SVGElement {
    const svgNamespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNamespace, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "12");
    svg.setAttribute("height", "12");
    svg.setAttribute("fill", "var(--color-warning)");
    svg.setAttribute("stroke", "none");
    
    svg.style.width = "12px";
    svg.style.height = "12px";
    svg.style.display = "block";

    const path1 = document.createElementNS(svgNamespace, "path");
    path1.setAttribute("d", "M21 8l-9-4-9 4v8l9 4 9-4V8z");
    svg.appendChild(path1);

    const path2 = document.createElementNS(svgNamespace, "path");
    path2.setAttribute("d", "M3 8l9 4 9-4");
    svg.appendChild(path2);

    const path3 = document.createElementNS(svgNamespace, "path");
    path3.setAttribute("d", "M12 20V12");
    svg.appendChild(path3);

    return svg;
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
