import { VALID_TRANSITIONS } from "@src/renderer/ScreenTransitions";
import { SessionManager } from "@src/renderer/SessionManager";
import { Logger } from "@src/shared/Logger";

export type ScreenId =
  | "main-menu"
  | "campaign"
  | "mission-setup"
  | "equipment"
  | "mission"
  | "barracks"
  | "debrief"
  | "campaign-summary"
  | "statistics"
  | "engineering"
  | "settings";

export class ScreenManager {
  private screens: Map<ScreenId, HTMLElement> = new Map();
  private currentScreen: ScreenId = "main-menu";
  private history: { id: ScreenId; isCampaign: boolean }[] = [];
  private sessionManager: SessionManager;
  private onExternalChange?: (id: ScreenId) => void;
  private currentIsCampaign: boolean = false;

  constructor(onExternalChange?: (id: ScreenId) => void) {
    this.sessionManager = new SessionManager();
    this.onExternalChange = onExternalChange;
    this.registerScreen("main-menu");
    this.registerScreen("campaign");
    this.registerScreen("mission-setup");
    this.registerScreen("equipment");
    this.registerScreen("mission");
    this.registerScreen("barracks");
    this.registerScreen("debrief");
    this.registerScreen("campaign-summary");
    this.registerScreen("statistics");
    this.registerScreen("engineering");
    this.registerScreen("settings");

    // Force show initial screen without transition validation
    this.currentScreen = "main-menu";
    this.currentIsCampaign = false;
    const el = this.screens.get("main-menu");
    if (el) el.style.display = "flex";

    window.addEventListener("hashchange", () => this.syncWithUrl());
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
  ) {
    if (this.currentScreen === id) {
      // Even if it's the same screen, ensure hash is in sync
      if (updateHash && window.location.hash !== `#${id}`) {
        window.location.hash = id;
      }
      this.currentIsCampaign = isCampaign;
      this.sessionManager.saveState(id, isCampaign);
      return;
    }

    // Validate transition
    const validNext = VALID_TRANSITIONS[this.currentScreen];
    if (!validNext || !validNext.includes(id)) {
      Logger.error(
        `Invalid screen transition: ${this.currentScreen} -> ${id}`,
      );
      return;
    }

    // Hide current
    const currentEl = this.screens.get(this.currentScreen);
    if (currentEl) {
      currentEl.style.display = "none";
    }

    // Push to history if we are navigating deeper (not back to menu necessarily, but let's keep it simple)
    if (id !== "main-menu") {
      this.history.push({
        id: this.currentScreen,
        isCampaign: this.currentIsCampaign,
      });
    } else {
      this.history = []; // Reset history on returning to menu
    }

    // Show new
    this.currentScreen = id;
    this.currentIsCampaign = isCampaign;
    this.sessionManager.saveState(id, isCampaign);
    const newEl = this.screens.get(id);
    if (newEl) {
      newEl.style.display = "flex"; // Assuming flex layout for screens
    } else {
      Logger.error(`[ScreenManager] Screen element for ${id} not found!`);
    }

    if (updateHash) {
      window.location.hash = id === "main-menu" ? "" : id;
    }
  }

  private syncWithUrl() {
    const hash = (window.location.hash.replace(/^#\/?/, "") ||
      "main-menu") as ScreenId;
    if (this.isValidScreenId(hash) && hash !== this.currentScreen) {
      // Validate transition if it's not a direct navigation (like back button)
      // Actually, for back button/direct URL we might want to bypass validation or handle it gracefully
      // For now, let's use a "forceShow" like approach but with validation logging

      const validNext = VALID_TRANSITIONS[this.currentScreen];
      if (validNext && validNext.includes(hash)) {
        this.show(hash, false, this.isCampaignMode(hash));
        if (this.onExternalChange) {
          this.onExternalChange(hash);
        }
      } else {
        Logger.warn(
          `External navigation to ${hash} is not a standard transition from ${this.currentScreen}`,
        );
        // Still show it because user explicitly changed URL or pressed back
        this.forceShow(hash, this.isCampaignMode(hash));
        if (this.onExternalChange) {
          this.onExternalChange(hash);
        }
      }
    }
  }

  private isCampaignMode(id: ScreenId): boolean {
    const state = this.sessionManager.loadState();
    if (state && state.screenId === id) {
      return state.isCampaign;
    }
    // Screens that are inherently campaign-related
    return id === "campaign" || id === "barracks" || id === "campaign-summary";
  }

  private forceShow(id: ScreenId, isCampaign: boolean = false) {
    if (this.currentScreen === id) {
      this.currentIsCampaign = isCampaign;
      this.sessionManager.saveState(id, isCampaign);
      return;
    }

    const currentEl = this.screens.get(this.currentScreen);
    if (currentEl) currentEl.style.display = "none";

    this.currentScreen = id;
    this.currentIsCampaign = isCampaign;
    this.sessionManager.saveState(id, isCampaign);
    const newEl = this.screens.get(id);
    if (newEl) newEl.style.display = "flex";
  }

  private isValidScreenId(id: string): id is ScreenId {
    return this.screens.has(id as ScreenId);
  }

  public goBack() {
    if (this.history.length > 0) {
      const prev = this.history.pop();
      if (prev) {
        this.forceShow(prev.id, prev.isCampaign);
        window.location.hash = prev.id === "main-menu" ? "" : prev.id;
      }
    } else {
      // Default fallback
      this.show("main-menu");
    }
  }

  public getCurrentScreen(): ScreenId {
    return this.currentScreen;
  }

  public loadPersistedState(): {
    screenId: ScreenId;
    isCampaign: boolean;
  } | null {
    const hash = window.location.hash.replace(/^#\/?/, "") as ScreenId;
    if (this.isValidScreenId(hash)) {
      const isCampaign = this.isCampaignMode(hash);
      this.forceShow(hash, isCampaign);
      return { screenId: hash, isCampaign };
    }

    const persisted = this.sessionManager.loadState();
    if (persisted && persisted.screenId !== this.currentScreen) {
      this.forceShow(persisted.screenId, persisted.isCampaign);
      return persisted;
    }
    return null;
  }
}