export type ScreenId = "main-menu" | "campaign" | "mission-setup" | "equipment" | "mission" | "debrief";

export class ScreenManager {
  private screens: Map<ScreenId, HTMLElement> = new Map();
  private currentScreen: ScreenId = "main-menu";
  private history: ScreenId[] = [];

  constructor() {
    this.registerScreen("main-menu");
    this.registerScreen("campaign");
    this.registerScreen("mission-setup");
    this.registerScreen("equipment");
    this.registerScreen("mission");
    this.registerScreen("debrief");

    this.show("main-menu");
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
    // Hide current
    const currentEl = this.screens.get(this.currentScreen);
    if (currentEl) currentEl.style.display = "none";

    // Push to history if we are navigating deeper (not back to menu necessarily, but let's keep it simple)
    if (id !== "main-menu" && this.currentScreen !== id) {
      this.history.push(this.currentScreen);
    } else {
      this.history = []; // Reset history on returning to menu
    }

    // Show new
    this.currentScreen = id;
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
}
