import { CampaignManager } from "@src/renderer/campaign/CampaignManager";

export type CampaignTabId = "sector-map" | "barracks" | "engineering" | "stats";
export type CampaignShellMode = "campaign" | "statistics" | "custom" | "none";

export class CampaignShell {
  private container: HTMLElement;
  private manager: CampaignManager;
  private onTabChange: (tabId: CampaignTabId) => void;
  private onMenu: () => void;
  private onSettings: () => void;
  private activeTabId: CampaignTabId = "sector-map";
  private mode: CampaignShellMode = "none";
  private showTabs: boolean = true;

  constructor(
    containerId: string,
    manager: CampaignManager,
    onTabChange: (tabId: CampaignTabId) => void,
    onMenu: () => void,
    onSettings: () => void,
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.manager = manager;
    this.onTabChange = onTabChange;
    this.onMenu = onMenu;
    this.onSettings = onSettings;
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
    topBar.style.height = "52px"; // Increased from 50px to accommodate 32px buttons with p-10
    topBar.style.boxSizing = "border-box";
    topBar.style.background = "var(--color-surface-elevated)";
    topBar.style.borderBottom = "1px solid var(--color-border-strong)";
    topBar.style.flexShrink = "0"; // Ensure top bar doesn't shrink
    topBar.innerHTML = "";

    // Left: Label
    const leftPart = document.createElement("div");
    leftPart.className = "flex-col";

    if (this.mode === "campaign") {
      leftPart.innerHTML = `
        <div style="font-size: 0.7em; color: var(--color-text-dim); text-transform: uppercase; letter-spacing: 1px;">Campaign Mode</div>
        <div style="font-size: 0.9em; font-weight: bold; color: var(--color-primary);">${state ? `Sector ${currentSector}` : "New Expedition"}</div>
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

    // Right Side: Resources + Navigation + Menu
    const rightSide = document.createElement("div");
    rightSide.className = "flex-row align-center gap-20";

    // Resources
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
      rightSide.appendChild(resources);
    }

    // Navigation Tabs
    const nav = document.createElement("div");
    nav.className = "flex-row gap-5";

    if (this.mode === "campaign" && state && this.showTabs) {
      const tabs: { id: CampaignTabId; label: string }[] = [
        { id: "sector-map", label: "Sector Map" },
        { id: "barracks", label: "Barracks" },
        { id: "stats", label: "Service Record" },
      ];

      tabs.forEach((tab) => {
        const btn = document.createElement("button");
        btn.textContent = tab.label;
        btn.className = `tab-button ${this.activeTabId === tab.id ? "active" : ""}`;
        btn.style.padding = "5px 12px";
        btn.style.height = "32px";
        btn.style.fontSize = "0.85em";
        btn.style.display = "flex";
        btn.style.alignItems = "center";
        btn.onclick = () => {
          if (this.activeTabId !== tab.id) {
            this.onTabChange(tab.id);
          }
        };
        nav.appendChild(btn);
      });
    }
    rightSide.appendChild(nav);

    const settingsBtn = document.createElement("button");
    settingsBtn.textContent = "Settings";
    settingsBtn.className = "menu-button";
    settingsBtn.style.margin = "0";
    settingsBtn.style.padding = "5px 12px";
    settingsBtn.style.height = "32px";
    settingsBtn.style.fontSize = "0.85em";
    settingsBtn.style.display = "flex";
    settingsBtn.style.alignItems = "center";
    settingsBtn.onclick = () => this.onSettings();
    rightSide.appendChild(settingsBtn);

    const menuBtn = document.createElement("button");
    menuBtn.textContent = "Main Menu";
    menuBtn.className = "back-button";
    menuBtn.style.margin = "0";
    menuBtn.style.padding = "5px 12px";
    menuBtn.style.height = "32px";
    menuBtn.style.fontSize = "0.85em";
    menuBtn.style.display = "flex";
    menuBtn.style.alignItems = "center";
    menuBtn.onclick = () => this.onMenu();
    rightSide.appendChild(menuBtn);

    topBar.appendChild(rightSide);

    // Content Area (Ensuring it exists but NOT clearing it)
    let contentArea = this.container.querySelector(
      "#campaign-shell-content",
    ) as HTMLElement;
    if (!contentArea) {
      contentArea = document.createElement("div");
      contentArea.id = "campaign-shell-content";
      this.container.appendChild(contentArea);
    }
    contentArea.className = "flex-grow relative overflow-hidden";
    contentArea.style.minHeight = "0"; // ADR 0028: Crucial for flex child to be constrained
  }
}
