import { InputContext, ShortcutInfo } from "@src/shared/types";

export class InputDispatcher {
  private static instance: InputDispatcher;
  private contextStack: InputContext[] = [];
  private focusStack: HTMLElement[] = [];

  private constructor() {
    window.addEventListener("keydown", this.handleKeyDown.bind(this), true);
    window.addEventListener("touchstart", this.handleTouchStart.bind(this), {
      passive: false,
    });
    window.addEventListener("touchmove", this.handleTouchMove.bind(this), {
      passive: false,
    });
    window.addEventListener("touchend", this.handleTouchEnd.bind(this), {
      passive: false,
    });
    window.addEventListener("mousedown", this.handleMouseDown.bind(this), true);
    window.addEventListener("mousemove", this.handleMouseMove.bind(this), true);
    window.addEventListener("mouseup", this.handleMouseUp.bind(this), true);
    window.addEventListener("wheel", this.handleWheel.bind(this), {
      passive: false,
    });
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
    const topFocusTrap = this.contextStack.find(
      (c) => c.trapsFocus && c.container,
    );
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

  private handleTouchStart(e: TouchEvent) {
    for (const context of this.contextStack) {
      if (context.handleTouchStart && context.handleTouchStart(e)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
  }

  private handleTouchMove(e: TouchEvent) {
    for (const context of this.contextStack) {
      if (context.handleTouchMove && context.handleTouchMove(e)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
  }

  private handleTouchEnd(e: TouchEvent) {
    for (const context of this.contextStack) {
      if (context.handleTouchEnd && context.handleTouchEnd(e)) {
        // NOTE: Don't always preventDefault on touchend as it might block clicks
        // But if context handled it, we should stop propagation.
        e.stopPropagation();
        return;
      }
    }
  }

  private handleMouseDown(e: MouseEvent) {
    for (const context of this.contextStack) {
      if (context.handleMouseDown && context.handleMouseDown(e)) {
        // e.preventDefault(); // Don't prevent default on mousedown by default
        e.stopPropagation();
        return;
      }
    }
  }

  private handleMouseMove(e: MouseEvent) {
    for (const context of this.contextStack) {
      if (context.handleMouseMove && context.handleMouseMove(e)) {
        e.stopPropagation();
        return;
      }
    }
  }

  private handleMouseUp(e: MouseEvent) {
    for (const context of this.contextStack) {
      if (context.handleMouseUp && context.handleMouseUp(e)) {
        e.stopPropagation();
        return;
      }
    }
  }

  private handleWheel(e: WheelEvent) {
    for (const context of this.contextStack) {
      if (context.handleWheel && context.handleWheel(e)) {
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
      if (document.activeElement === firstElement || !container.contains(document.activeElement)) {
        lastElement.focus();
        e.preventDefault();
      }
    } else {
      // Tab: focus next
      if (document.activeElement === lastElement || !container.contains(document.activeElement)) {
        firstElement.focus();
        e.preventDefault();
      }
    }
  }
}