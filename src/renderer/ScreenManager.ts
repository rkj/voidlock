import { Logger } from "@src/shared/Logger";
import { SessionManager } from "./SessionManager";
import { VALID_TRANSITIONS } from "./ScreenTransitions";

export type ScreenId =
  | "main-menu"
  | "campaign"
  | "mission-setup"
  | "equipment"
  | "mission"
  | "debrief"
  | "campaign-summary"
  | "statistics"
  | "engineering"
  | "settings";

export interface IScreen {
  show(...args: unknown[]): void;
  hide(): void;
}

export class ScreenManager {
  private screens: Map<string, HTMLElement> = new Map();
  public currentScreen: ScreenId = "main-menu";
  private currentIsCampaign: boolean = false;
  public history: { id: ScreenId; isCampaign: boolean }[] = [];
  private isInternalTransition: boolean = false;
  private sessionManager: SessionManager;

  constructor(private onScreenChange: (id: ScreenId, isCampaign: boolean) => void) {
    this.sessionManager = new SessionManager();
    const ids: ScreenId[] = [
      "main-menu",
      "campaign",
      "mission-setup",
      "equipment",
      "mission",
      "debrief",
      "campaign-summary",
      "statistics",
      "engineering",
      "settings",
    ];
    ids.forEach((id) => this.registerScreen(id));

    // Default screen
    const el = this.screens.get("main-menu");
    if (el) el.style.display = "flex";

    this.hashHandler = () => this.syncWithUrl();
    window.addEventListener("hashchange", this.hashHandler);
  }

  private hashHandler: () => void;

  public destroy() {
    window.removeEventListener("hashchange", this.hashHandler);
    this.history = [];
  }

  private registerScreen(id: ScreenId) {
    const el = document.getElementById(`screen-${id}`);
    if (el) {
      this.screens.set(id, el);
    } else {
      Logger.error(`Screen element #screen-${id} not found!`);
    }
  }

  public show(
    id: ScreenId,
    updateHash: boolean = true,
    isCampaign: boolean = false,
    skipHistory: boolean = false,
  ) {
    this.showEx({ id, updateHash, isCampaign, skipHistory, force: false });
  }

  public showEx(params: {
    id: ScreenId;
    updateHash?: boolean;
    isCampaign?: boolean;
    skipHistory?: boolean;
    force?: boolean;
  }) {
    const { id, updateHash = true, isCampaign = false, skipHistory = false, force = false } = params;
    if (this.currentScreen === id) {
      if (updateHash) {
        this.updateHash(id);
      }
      this.currentIsCampaign = isCampaign;
      this.sessionManager.saveState(id, isCampaign);
      
      const el = this.screens.get(id);
      if (el) el.style.display = "flex";
      
      return;
    }

    if (!force) {
      const validNext = VALID_TRANSITIONS[this.currentScreen];
      if (!validNext?.includes(id)) {
        Logger.error(`Invalid screen transition: ${this.currentScreen} -> ${id}`);
        return;
      }
    }

    // Hide all screens first
    this.screens.forEach((el, screenId) => {
      if (screenId !== id) {
        el.style.display = "none";
      }
    });

    if (!skipHistory) {
      if (id !== "main-menu") {
        this.history.push({
          id: this.currentScreen,
          isCampaign: this.currentIsCampaign,
        });
      } else {
        this.history = [];
      }
    }

    this.currentScreen = id;
    this.currentIsCampaign = isCampaign;

    const newEl = this.screens.get(id);
    if (newEl) {
      newEl.style.display = "flex";
    }

    if (updateHash) {
      this.updateHash(id);
    }

    this.sessionManager.saveState(id, isCampaign);
  }

  public goBack() {
    if (this.history.length > 0) {
      const prev = this.history.pop();
      if (prev) this.show(prev.id, true, prev.isCampaign, true);
    } else if (this.currentScreen !== "main-menu") {
      this.show("main-menu", true, false, true);
    }
  }

  private updateHash(id: string) {
    const currentHash = window.location.hash;
    const newHash = id === "main-menu" ? "" : `#${id}`;
    if (currentHash !== newHash) {
      this.isInternalTransition = true;
      window.location.hash = newHash;
    }
  }

  private syncWithUrl() {
    if (this.isInternalTransition) {
      this.isInternalTransition = false;
      return;
    }

    const hash = (window.location.hash.replace("#", "") || "main-menu") as ScreenId;
    const validScreens: ScreenId[] = [
      "main-menu",
      "campaign",
      "mission-setup",
      "equipment",
      "mission",
      "debrief",
      "campaign-summary",
      "statistics",
      "engineering",
      "settings",
    ];

    if (validScreens.includes(hash)) {
      this.onScreenChange(hash, this.currentIsCampaign);
    }
  }

  public forceShow(id: ScreenId, isCampaign: boolean = false) {
    this.currentScreen = id;
    this.currentIsCampaign = isCampaign;
    this.screens.forEach((el, screenId) => {
      el.style.display = screenId === id ? "flex" : "none";
    });
    this.updateHash(id);
  }

  public getScreenElement(id: string): HTMLElement | null {
    return this.screens.get(id) ?? null;
  }

  public getCurrentScreen(): ScreenId {
    return this.currentScreen;
  }

  public loadPersistedState(): { screenId: ScreenId; isCampaign: boolean } | null {
    // URL hash takes precedence.
    const currentHash = window.location.hash.replace("#", "");
    const validScreens: ScreenId[] = [
      "main-menu",
      "campaign",
      "mission-setup",
      "equipment",
      "mission",
      "debrief",
      "campaign-summary",
      "statistics",
      "engineering",
      "settings",
    ];

    if (currentHash && validScreens.includes(currentHash as ScreenId)) {
      const persisted = this.sessionManager.loadState();
      const isCampaign = persisted?.screenId === currentHash ? persisted.isCampaign : false;
      
      // Update internal state if different
      if (currentHash !== this.currentScreen) {
        this.forceShow(currentHash as ScreenId, isCampaign);
      }
      
      return { screenId: currentHash as ScreenId, isCampaign };
    }

    if (currentHash === "") {
      return null;
    }

    const persisted = this.sessionManager.loadState();
    if (persisted && persisted.screenId !== this.currentScreen) {
      this.forceShow(persisted.screenId, persisted.isCampaign);
      return persisted;
    }
    return null;
  }
}
