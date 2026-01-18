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
  | "statistics"
  | "campaign-shell";

export class ScreenManager {
  private screens: Map<ScreenId, HTMLElement> = new Map();
  private currentScreen: ScreenId = "main-menu";
  private history: ScreenId[] = [];
  private sessionManager: SessionManager;

  constructor() {
    this.sessionManager = new SessionManager();
    this.registerScreen("main-menu");
    this.registerScreen("campaign-shell");
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
  }

  private registerScreen(id: ScreenId) {
    const el = document.getElementById(`screen-${id}`);
    if (el) {
      this.screens.set(id, el);
    } else {
      console.error(`Screen element #screen-${id} not found!`);
    }
  }

  public show(id: ScreenId) {
    if (this.currentScreen === id) return;

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
    if (currentEl) currentEl.style.display = "none";

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
    if (newEl) newEl.style.display = "flex"; // Assuming flex layout for screens
  }

  public goBack() {
    if (this.history.length > 0) {
      const prev = this.history.pop();
      if (prev) {
        // Hide current
        const currentEl = this.screens.get(this.currentScreen);
        if (currentEl) currentEl.style.display = "none";

        // Show prev
        this.currentScreen = prev;
        const prevEl = this.screens.get(prev);
        if (prevEl) prevEl.style.display = "flex";
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
    const persisted = this.sessionManager.loadState();
    if (persisted && persisted !== this.currentScreen) {
      // We use a simplified show() without transition validation for restoration
      const currentEl = this.screens.get(this.currentScreen);
      if (currentEl) currentEl.style.display = "none";

      this.currentScreen = persisted;
      const newEl = this.screens.get(this.currentScreen);
      if (newEl) newEl.style.display = "flex";
      return persisted;
    }
    return null;
  }
}
