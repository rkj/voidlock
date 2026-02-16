import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { InputDispatcher } from "../InputDispatcher";
import { InputPriority } from "@src/shared/types";
import { UIUtils } from "../utils/UIUtils";

export type CampaignTabId =
  | "sector-map"
  | "barracks"
  | "engineering"
  | "stats"
  | "settings"
  | "setup"
  | "main-menu";
export type CampaignShellMode =
  | "campaign"
  | "statistics"
  | "custom"
  | "global"
  | "none";

export class CampaignShell {
  private container: HTMLElement;
  private manager: CampaignManager;
  private metaManager: MetaManager;
  private onTabChange: (tabId: CampaignTabId) => void;
  private onMenu: () => void;
  private activeTabId: CampaignTabId = "sector-map";
  private mode: CampaignShellMode = "none";
  private showTabs: boolean = true;

  constructor(
    containerId: string,
    manager: CampaignManager,
    metaManager: MetaManager,
    onTabChange: (tabId: CampaignTabId) => void,
    onMenu: () => void,
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.manager = manager;
    this.metaManager = metaManager;
    this.onTabChange = onTabChange;
    this.onMenu = onMenu;
  }

  public show(
    mode: CampaignShellMode,
    activeTabId: CampaignTabId = "sector-map",
    showTabs: boolean = true,
  ) {
    this.mode = mode;
    this.activeTabId = activeTabId;
    this.showTabs = showTabs;
    this.container.style.display = "flex";
    this.render();
    this.pushInputContext();
  }

  public hide() {
    this.mode = "none";
    this.container.style.display = "none";
    InputDispatcher.getInstance().popContext("campaign-shell");
  }

  private pushInputContext() {
    InputDispatcher.getInstance().pushContext({
      id: "campaign-shell",
      priority: InputPriority.UI - 1, // Slightly lower than active screen
      trapsFocus: false, // Shell shouldn't trap focus because content area needs it
      handleKeyDown: (e) => this.handleKeyDown(e),
      getShortcuts: () => [],
    });
  }

  private handleKeyDown(e: KeyboardEvent): boolean {
    if (this.mode === "none") return false;

    // Navigation between tabs via arrow keys if focus is on a tab
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const topBar = this.container.querySelector(
        "#campaign-shell-top-bar",
      ) as HTMLElement;
      if (topBar && topBar.contains(document.activeElement)) {
        return UIUtils.handleArrowNavigation(e, topBar, {
          orientation: "horizontal",
        });
      }
    }

    return false;
  }

  public refresh() {
    if (this.container.style.display !== "none") {
      this.render();
    }
  }

  public getContentContainer(): HTMLElement {
    return this.container.querySelector(
      "#campaign-shell-content",
    ) as HTMLElement;
  }

  private render() {
    this.container.className = "campaign-shell flex-col h-full w-full";

    const state = this.manager.getState();
    const scrap = state?.scrap ?? 0;
    const intel = state?.intel ?? 0;
    const currentSector = state?.currentSector ?? 1;

    // Top Bar
    let topBar = this.container.querySelector(
      "#campaign-shell-top-bar",
    ) as HTMLElement;
    if (!topBar) {
      topBar = document.createElement("div");
      topBar.id = "campaign-shell-top-bar";
      this.container.prepend(topBar);
    }

    topBar.className =
      "campaign-top-bar flex-row justify-between align-center p-10";
    topBar.innerHTML = "";

    // Left: Label
    const leftPart = document.createElement("div");
    leftPart.className = "flex-col";

    if (this.mode === "campaign") {
      leftPart.innerHTML = `
        <div style="font-size: 0.7em; color: var(--color-text-dim); letter-spacing: 1px;">Campaign Mode</div>
        <div style="font-size: 0.9em; font-weight: bold; color: var(--color-primary);">${state ? `Sector ${currentSector}` : "New Expedition"}</div>
      `;
    } else if (this.mode === "statistics") {
      leftPart.innerHTML = `
        <div style="font-size: 0.7em; color: var(--color-text-dim); letter-spacing: 1px;">Service Record</div>
        <div style="font-size: 0.9em; font-weight: bold; color: var(--color-primary);">Global Statistics</div>
      `;
    } else if (this.mode === "custom") {
      leftPart.innerHTML = `
        <div style="font-size: 0.7em; color: var(--color-text-dim); letter-spacing: 1px;">Custom Mission</div>
        <div style="font-size: 0.9em; font-weight: bold; color: var(--color-primary);">Simulation Setup</div>
      `;
    } else if (this.mode === "global") {
      leftPart.innerHTML = `
        <div style="font-size: 0.7em; color: var(--color-text-dim); letter-spacing: 1px;">Settings</div>
        <div style="font-size: 0.9em; font-weight: bold; color: var(--color-primary);">Global Configuration</div>
      `;
    }
    topBar.appendChild(leftPart);

    // Right Side: Resources + Navigation + Menu
    const rightSide = document.createElement("div");
    rightSide.className = "shell-controls-right flex-row align-center gap-20";
    rightSide.style.flexShrink = "1";
    rightSide.style.minWidth = "0";
    rightSide.style.overflow = "hidden";
    rightSide.style.maxWidth = "100%"; // Ensure it doesn't exceed parent width

    // Resources
    if (this.mode === "campaign" && state) {
      const resources = document.createElement("div");
      resources.className = "shell-resources flex-row gap-15";
      // Hide resources on small screens to save space
      if (window.innerWidth < 600) {
        resources.style.display = "none";
      }
      resources.innerHTML = `
        <div class="resource-item" title="Scrap (Currency)">
          <span style="color: var(--color-text-dim)">Scrap:</span>
          <span style="color: var(--color-primary); font-weight: bold;">${scrap}</span>
        </div>
        <div class="resource-item" title="Intel (Tech/Unlock)">
          <span style="color: var(--color-text-dim)">Intel:</span>
          <span style="color: var(--color-accent); font-weight: bold;">${intel}</span>
        </div>
      `;
      rightSide.appendChild(resources);
    }

    // Navigation Tabs
    const nav = document.createElement("div");
    nav.className = "shell-tabs flex-row gap-5";
    nav.style.overflowX = "auto";
    nav.style.flexShrink = "1";
    nav.style.minWidth = "0";
    nav.style.maxWidth = "100%";
    nav.style.scrollbarWidth = "none"; // Hide scrollbar for cleaner look

    if (this.showTabs) {
      const tabs: { id: CampaignTabId; label: string }[] = [];

      if (this.mode === "campaign" && state) {
        tabs.push({ id: "sector-map", label: "Sector Map" });
        tabs.push({ id: "barracks", label: "Barracks" });
        tabs.push({ id: "engineering", label: "Engineering" });
        tabs.push({ id: "stats", label: "Service Record" });
        tabs.push({ id: "settings", label: "Settings" });
      } else if (this.mode === "statistics") {
        tabs.push({ id: "stats", label: "Service Record" });
        tabs.push({ id: "engineering", label: "Engineering" });
      } else if (this.mode === "custom") {
        tabs.push({ id: "setup", label: "Setup" });
        tabs.push({ id: "stats", label: "Service Record" });
        tabs.push({ id: "settings", label: "Settings" });
      }

      tabs.forEach((tab) => {
        const btn = document.createElement("button");
        btn.textContent = tab.label;
        btn.className = `tab-button shell-tab ${this.activeTabId === tab.id ? "active" : ""}`;
        btn.setAttribute("data-id", tab.id);
        btn.style.padding = "5px 12px";
        btn.style.height = "32px";
        btn.style.fontSize = "0.85em";
        btn.style.display = "flex";
        btn.style.alignItems = "center";
        btn.onclick = () => {
          if (tab.id === "main-menu") {
            this.onMenu();
          } else if (this.activeTabId !== tab.id) {
            this.onTabChange(tab.id);
          }
        };
        nav.appendChild(btn);
      });
    }
    rightSide.appendChild(nav);

    // Main Menu Button (Always on the far right)
    if (this.mode !== "none") {
      const menuBtn = document.createElement("button");
      menuBtn.textContent = "Main Menu";
      menuBtn.className = "back-button";
      menuBtn.style.margin = "0";
      menuBtn.style.padding = "5px 12px";
      menuBtn.style.height = "32px";
      menuBtn.style.fontSize = "0.85em";
      menuBtn.style.display = "flex";
      menuBtn.style.alignItems = "center";
      menuBtn.style.flexShrink = "0"; // Ensure button doesn't shrink
      menuBtn.onclick = () => this.onMenu();
      rightSide.appendChild(menuBtn);
    }

    topBar.appendChild(rightSide);

    // Content Area
    let contentArea = this.container.querySelector(
      "#campaign-shell-content",
    ) as HTMLElement;
    if (!contentArea) {
      contentArea = document.createElement("div");
      contentArea.id = "campaign-shell-content";
      this.container.appendChild(contentArea);
    }
    contentArea.className = "flex-grow relative overflow-hidden";
    contentArea.style.minHeight = "0";

    // Footer (Meta Stats)
    let footer = this.container.querySelector(
      "#campaign-shell-footer",
    ) as HTMLElement;
    if (!footer) {
      footer = document.createElement("div");
      footer.id = "campaign-shell-footer";
      this.container.appendChild(footer);
    }

    // Only show footer on sector map (Campaign mode)
    const shouldShowFooter =
      this.mode === "campaign" && this.activeTabId === "sector-map";

    if (shouldShowFooter) {
      footer.style.display = "flex";
      this.renderMetaStats(footer);
    } else {
      footer.style.display = "none";
    }
  }

  private renderMetaStats(container: HTMLElement) {
    const stats = this.metaManager.getStats();
    container.className = "campaign-footer flex-row align-center p-10 gap-20";
    container.style.background = "rgba(0, 0, 0, 0.6)";
    container.style.backdropFilter = "blur(4px)";
    container.style.borderTop = "1px solid var(--color-border)";
    container.style.fontSize = "0.7em";
    container.style.color = "var(--color-text-dim)";
    container.style.pointerEvents = "none";
    container.style.boxSizing = "border-box";
    container.style.height = "28px";
    container.style.flexShrink = "0";

    container.innerHTML = `
      <div class="flex-row gap-5" style="align-items: center;">
        <span style="letter-spacing: 1px; opacity: 0.7;">Lifetime Xeno Purged:</span>
        <span style="color: var(--color-primary); font-weight: bold;">${stats.totalKills.toLocaleString()}</span>
      </div>
      <div class="flex-row gap-5" style="align-items: center;">
        <span style="letter-spacing: 1px; opacity: 0.7;">Expeditions:</span>
        <span style="color: var(--color-primary); font-weight: bold;">${stats.totalCampaignsStarted.toLocaleString()}</span>
      </div>
      <div class="flex-row gap-5" style="align-items: center;">
        <span style="letter-spacing: 1px; opacity: 0.7;">Missions Won:</span>
        <span style="color: var(--color-primary); font-weight: bold;">${stats.totalMissionsWon.toLocaleString()}</span>
      </div>
      
      <div class="flex-grow"></div>

      <div id="sync-status-indicator" class="sync-status">
        <!-- Will be filled by updateSyncUI -->
      </div>
    `;

    this.updateSyncUI(
      container.querySelector("#sync-status-indicator") as HTMLElement,
    );
  }

  private updateSyncUI(el: HTMLElement) {
    const status = this.manager.getSyncStatus();
    let icon = "💾";
    let text = "Local Only";
    let className = "local";

    if (status === "synced") {
      icon = "☁️";
      text = "Cloud Synced";
      className = "synced";
    } else if (status === "syncing") {
      icon = "🔄";
      text = "Syncing...";
      className = "syncing";
    }

    el.className = `sync-status ${className}`;
    el.innerHTML = `
      <span class="sync-icon">${icon}</span>
      <span>${text}</span>
    `;
    el.title = `Data Storage Status: ${text}`;
  }
}
