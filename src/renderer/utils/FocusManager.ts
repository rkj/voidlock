export class FocusManager {
  private static savedSelector: string | null = null;

  /**
   * Saves the current focus state.
   */
  public static saveFocus() {
    const active = document.activeElement as HTMLElement;
    if (!active || active === document.body) {
      this.savedSelector = null;
      return;
    }

    // Prefer data-focus-id
    const focusId = active.getAttribute("data-focus-id");
    if (focusId) {
      this.savedSelector = `[data-focus-id="${focusId}"]`;
      return;
    }

    // Fallback to a unique-ish selector if possible, 
    // but data-focus-id is much safer for re-renders.
    if (active.id) {
      this.savedSelector = `#${active.id}`;
    } else {
      // Very basic fallback: just use the class list if it's unique enough?
      // Better to just not restore if we can't be sure.
      this.savedSelector = null;
    }
  }

  /**
   * Restores focus to the saved element within the given container.
   */
  public static restoreFocus(container: HTMLElement) {
    if (!this.savedSelector) return;

    const el = container.querySelector(this.savedSelector) as HTMLElement;
    if (el) {
      el.focus();
    }
    this.savedSelector = null;
  }
}
