import { CampaignManager } from "@src/renderer/campaign/CampaignManager";

export type CampaignTabId = "sector-map" | "barracks" | "engineering" | "stats";
export type CampaignShellMode = "campaign" | "statistics" | "custom" | "none";

export class CampaignShell {
  private container: HTMLElement;
  private manager: CampaignManager;
  private onTabChange: (tabId: CampaignTabId) => void;
  private onMenu: () => void;
  private activeTabId: CampaignTabId = "sector-map";
  private mode: CampaignShellMode = "none";

  constructor(
    containerId: string,
    manager: CampaignManager,
    onTabChange: (tabId: CampaignTabId) => void,
    onMenu: () => void
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.manager = manager;
    this.onTabChange = onTabChange;
    this.onMenu = onMenu;
  }

  public show(mode: CampaignShellMode, activeTabId: CampaignTabId = "sector-map") {
    this.mode = mode;
    this.activeTabId = activeTabId;
    this.container.style.display = "flex";
    this.render();
  }

  public hide() {
    this.mode = "none";
    this.container.style.display = "none";
  }

  public refresh() {
    if (this.container.style.display !== "none") {
      this.render();
    }
  }

  public getContentContainer(): HTMLElement {
    return this.container.querySelector("#campaign-shell-content") as HTMLElement;
  }

  private render() {
    this.container.className = "campaign-shell flex-col h-full w-full";

    const state = this.manager.getState();
    const scrap = state?.scrap ?? 0;
    const intel = state?.intel ?? 0;
    const currentSector = state?.currentSector ?? 1;

    // Top Bar
    let topBar = this.container.querySelector("#campaign-shell-top-bar") as HTMLElement;
    if (!topBar) {
      topBar = document.createElement("div");
      topBar.id = "campaign-shell-top-bar";
      this.container.prepend(topBar);
    }

    topBar.className = "campaign-top-bar flex-row justify-between align-center p-10";
    topBar.style.height = "50px";
    topBar.style.background = "var(--color-surface-elevated)";
    topBar.style.borderBottom = "1px solid var(--color-border-strong)";
    topBar.innerHTML = "";

    // Left: Label
    const leftPart = document.createElement("div");
    leftPart.className = "flex-col";
    
    if (this.mode === "campaign" && state) {
      leftPart.innerHTML = `
        <div style="font-size: 0.7em; color: var(--color-text-dim); text-transform: uppercase; letter-spacing: 1px;">Campaign Mode</div>
        <div style="font-size: 0.9em; font-weight: bold; color: var(--color-primary);">Sector ${currentSector}</div>
      `;
    } else if (this.mode === "statistics") {
      leftPart.innerHTML = `
        <div style="font-size: 0.7em; color: var(--color-text-dim); text-transform: uppercase; letter-spacing: 1px;">Service Record</div>
        <div style="font-size: 0.9em; font-weight: bold; color: var(--color-primary);">Global Statistics</div>
      `;
    } else if (this.mode === "custom") {
      leftPart.innerHTML = `
        <div style="font-size: 0.7em; color: var(--color-text-dim); text-transform: uppercase; letter-spacing: 1px;">Custom Mission</div>
        <div style="font-size: 0.9em; font-weight: bold; color: var(--color-primary);">Simulation Setup</div>
      `;
    }
    topBar.appendChild(leftPart);

    // Center: Navigation
    const nav = document.createElement("div");
    nav.className = "flex-row gap-10";

    if (this.mode === "campaign" && state) {
      const tabs: { id: CampaignTabId; label: string }[] = [
        { id: "sector-map", label: "Sector Map" },
        { id: "barracks", label: "Barracks" },
        // { id: "engineering", label: "Engineering" }, // Future
        { id: "stats", label: "Service Record" },
      ];

      tabs.forEach((tab) => {
        const btn = document.createElement("button");
        btn.textContent = tab.label;
        btn.className = `tab-button ${this.activeTabId === tab.id ? "active" : ""}`;
        btn.style.padding = "5px 15px";
        btn.style.fontSize = "0.9em";
        btn.onclick = () => {
          if (this.activeTabId !== tab.id) {
            this.onTabChange(tab.id);
          }
        };
        nav.appendChild(btn);
      });
    }
    topBar.appendChild(nav);

    // Right: Resources
    const rightPart = document.createElement("div");
    rightPart.className = "flex-row align-center gap-20";

    if (this.mode === "campaign" && state) {
      const resources = document.createElement("div");
      resources.className = "flex-row gap-15";
      resources.innerHTML = `
        <div class="resource-item" title="Scrap (Currency)">
          <span style="color: var(--color-text-dim)">SCRAP:</span>
          <span style="color: var(--color-primary); font-weight: bold;">${scrap}</span>
        </div>
        <div class="resource-item" title="Intel (Tech/Unlock)">
          <span style="color: var(--color-text-dim)">INTEL:</span>
          <span style="color: var(--color-accent); font-weight: bold;">${intel}</span>
        </div>
      `;
      rightPart.appendChild(resources);
    }

    const menuBtn = document.createElement("button");
    menuBtn.textContent = "Main Menu";
    menuBtn.className = "back-button";
    menuBtn.style.margin = "0";
    menuBtn.style.padding = "5px 10px";
    menuBtn.onclick = () => this.onMenu();
    rightPart.appendChild(menuBtn);

    topBar.appendChild(rightPart);

    // Content Area (Ensuring it exists but NOT clearing it)
    let contentArea = this.container.querySelector("#campaign-shell-content") as HTMLElement;
    if (!contentArea) {
      contentArea = document.createElement("div");
      contentArea.id = "campaign-shell-content";
      contentArea.className = "flex-grow relative overflow-hidden";
      this.container.appendChild(contentArea);
    }
  }
}
