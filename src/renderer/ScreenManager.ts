import { VALID_TRANSITIONS } from "@src/renderer/ScreenTransitions";
import { SessionManager } from "@src/renderer/SessionManager";

export type ScreenId =
  | "main-menu"
  | "campaign"
  | "mission-setup"
  | "equipment"
  | "mission"
  | "barracks"
  | "debrief"
  | "campaign-summary"
  | "statistics";

export class ScreenManager {
  private screens: Map<ScreenId, HTMLElement> = new Map();
  private currentScreen: ScreenId = "main-menu";
  private history: ScreenId[] = [];
  private sessionManager: SessionManager;
  private onExternalChange?: (id: ScreenId) => void;

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

    // Force show initial screen without transition validation
    this.currentScreen = "main-menu";
    const el = this.screens.get("main-menu");
    if (el) el.style.display = "flex";

    window.addEventListener("hashchange", () => this.syncWithUrl());
  }

  private registerScreen(id: ScreenId) {
    const el = document.getElementById(`screen-${id}`);
    if (el) {
      this.screens.set(id, el);
    } else {
      console.error(`Screen element #screen-${id} not found!`);
    }
  }

  public show(id: ScreenId, updateHash: boolean = true) {
    if (this.currentScreen === id) {
      // Even if it's the same screen, ensure hash is in sync
      if (updateHash && window.location.hash !== `#${id}`) {
        window.location.hash = id;
      }
      return;
    }

    // Validate transition
    const validNext = VALID_TRANSITIONS[this.currentScreen];
    if (!validNext || !validNext.includes(id)) {
      console.error(
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
      this.history.push(this.currentScreen);
    } else {
      this.history = []; // Reset history on returning to menu
    }

    // Show new
    this.currentScreen = id;
    this.sessionManager.saveState(id);
    const newEl = this.screens.get(id);
    if (newEl) {
      newEl.style.display = "flex"; // Assuming flex layout for screens
    } else {
      console.error(`[ScreenManager] Screen element for ${id} not found!`);
    }

    if (updateHash) {
      window.location.hash = id === "main-menu" ? "" : id;
    }
  }

  private syncWithUrl() {
    const hash = (window.location.hash.replace(/^#\/?/, "") || "main-menu") as ScreenId;
    if (this.isValidScreenId(hash) && hash !== this.currentScreen) {
      // Validate transition if it's not a direct navigation (like back button)
      // Actually, for back button/direct URL we might want to bypass validation or handle it gracefully
      // For now, let's use a "forceShow" like approach but with validation logging
      
      const validNext = VALID_TRANSITIONS[this.currentScreen];
      if (validNext && validNext.includes(hash)) {
        this.show(hash, false);
        if (this.onExternalChange) {
          this.onExternalChange(hash);
        }
      } else {
        console.warn(`External navigation to ${hash} is not a standard transition from ${this.currentScreen}`);
        // Still show it because user explicitly changed URL or pressed back
        this.forceShow(hash);
        if (this.onExternalChange) {
          this.onExternalChange(hash);
        }
      }
    }
  }

  private forceShow(id: ScreenId) {
    if (this.currentScreen === id) return;

    const currentEl = this.screens.get(this.currentScreen);
    if (currentEl) currentEl.style.display = "none";

    this.currentScreen = id;
    this.sessionManager.saveState(id);
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
        this.forceShow(prev);
        window.location.hash = prev === "main-menu" ? "" : prev;
      }
    } else {
      // Default fallback
      this.show("main-menu");
    }
  }

  public getCurrentScreen(): ScreenId {
    return this.currentScreen;
  }

  public loadPersistedState(): ScreenId | null {
    const hash = window.location.hash.replace(/^#\/?/, "") as ScreenId;
    if (this.isValidScreenId(hash)) {
      this.forceShow(hash);
      return hash;
    }

    const persisted = this.sessionManager.loadState();
    if (persisted && persisted !== this.currentScreen) {
      this.forceShow(persisted);
      return persisted;
    }
    return null;
  }
}
