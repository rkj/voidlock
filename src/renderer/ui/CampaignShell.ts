import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { InputDispatcher } from "../InputDispatcher";
import { InputPriority } from "@src/shared/types";
import { UIUtils } from "../utils/UIUtils";
import { CampaignShellTopBar, CampaignShellFooter } from "./CampaignShellUI";

export type CampaignTabId =
  | "sector-map"
  | "ready-room"
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
  private activeMissionType: string | null = null;
  private mode: CampaignShellMode = "none";
  private showTabs: boolean = true;
  private changeListener: () => void;

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

    this.changeListener = () => this.refresh();
    this.manager.addChangeListener(this.changeListener);
  }

  public show(
    mode: CampaignShellMode,
    activeTabId: CampaignTabId = "sector-map",
    showTabs: boolean = true,
    missionType: string | null = null,
  ) {

    this.mode = mode;
    this.activeTabId = activeTabId;
    this.showTabs = showTabs;
    this.activeMissionType = missionType;
    this.container.style.display = "flex";
    this.render();
    this.pushInputContext();
  }

  public hide() {

    this.mode = "none";
    this.activeMissionType = null;
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
    const metaStats = this.metaManager.getStats();
    const syncStatus = this.manager.getSyncStatus();

    // Top Bar
    const topBarUI = CampaignShellTopBar({
      mode: this.mode,
      activeTabId: this.activeTabId,
      showTabs: this.showTabs,
      state,
      activeMissionType: this.activeMissionType,
      onTabChange: (id) => this.onTabChange(id),
      onMenu: () => this.onMenu(),
    }) as HTMLElement;

    const existingTopBar = this.container.querySelector("#campaign-shell-top-bar");
    if (existingTopBar) {
      existingTopBar.innerHTML = "";
      while (topBarUI.firstChild) {
        existingTopBar.appendChild(topBarUI.firstChild);
      }
      existingTopBar.className = topBarUI.className;
    } else {
      this.container.prepend(topBarUI);
    }

    // Footer
    const existingFooter = this.container.querySelector("#campaign-shell-footer") as HTMLElement;
    
    if (this.mode === "campaign" && this.activeTabId === "sector-map") {
      const footerUI = CampaignShellFooter({ metaStats, syncStatus: syncStatus as any }) as HTMLElement;
      if (existingFooter) {
        existingFooter.style.display = "flex";
        existingFooter.innerHTML = "";
        while (footerUI.firstChild) {
          existingFooter.appendChild(footerUI.firstChild);
        }
        existingFooter.className = footerUI.className;
      } else {
        this.container.appendChild(footerUI);
      }
    } else if (existingFooter) {
      existingFooter.style.display = "none";
    }
  }
}
