import { InputContext, ShortcutInfo } from "@src/shared/types";

export class InputDispatcher {
  private static instance: InputDispatcher;
  private contextStack: InputContext[] = [];
  private focusStack: HTMLElement[] = [];

  private constructor() {
    window.addEventListener("keydown", this.handleKeyDown.bind(this), true);
  }

  public static getInstance(): InputDispatcher {
    if (!InputDispatcher.instance) {
      InputDispatcher.instance = new InputDispatcher();
    }
    return InputDispatcher.instance;
  }

  public pushContext(context: InputContext) {
    this.contextStack.push(context);
    this.contextStack.sort((a, b) => b.priority - a.priority);

    if (context.trapsFocus) {
      this.focusStack.push(document.activeElement as HTMLElement);
    }
  }

  public popContext(id: string) {
    const index = this.contextStack.findIndex((c) => c.id === id);
    if (index !== -1) {
      const [removed] = this.contextStack.splice(index, 1);
      if (removed.trapsFocus) {
        const lastFocus = this.focusStack.pop();
        if (lastFocus && document.body.contains(lastFocus)) {
          lastFocus.focus();
        }
      }
    }
  }

  public getActiveShortcuts(): ShortcutInfo[] {
    const shortcuts: ShortcutInfo[] = [];
    const seen = new Set<string>();

    // Iterate from top to bottom
    for (const context of this.contextStack) {
      for (const shortcut of context.getShortcuts()) {
        const key = `${shortcut.key}-${shortcut.code || ""}`;
        if (!seen.has(key)) {
          shortcuts.push(shortcut);
          seen.add(key);
        }
      }
    }
    return shortcuts;
  }

  private handleKeyDown(e: KeyboardEvent) {
    // Handle Focus Trapping for the top-most context that traps focus
    const topFocusTrap = this.contextStack.find((c) => c.trapsFocus && c.container);
    if (topFocusTrap && e.key === "Tab") {
      this.handleTabCycle(e, topFocusTrap.container!);
    }

    for (const context of this.contextStack) {
      if (context.handleKeyDown(e)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
  }

  private handleTabCycle(e: KeyboardEvent, container: HTMLElement) {
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) {
      e.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      // Shift + Tab: focus previous
      if (document.activeElement === firstElement) {
        lastElement.focus();
        e.preventDefault();
      }
    } else {
      // Tab: focus next
      if (document.activeElement === lastElement) {
        firstElement.focus();
        e.preventDefault();
      }
    }
  }
}