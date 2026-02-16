import { InputContext, ShortcutInfo } from "@src/shared/types";

export class InputDispatcher {
  private static instance: InputDispatcher;
  private contextStack: InputContext[] = [];
  private focusStack: HTMLElement[] = [];
  private nextOrder: number = 0;

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
    context._order = this.nextOrder++;

    const existingIndex = this.contextStack.findIndex(
      (c) => c.id === context.id,
    );
    if (existingIndex !== -1) {
      this.contextStack.splice(existingIndex, 1);
    }

    this.contextStack.push(context);
    this.contextStack.sort((a, b) => {
      const pA = a.priority || 0;
      const pB = b.priority || 0;
      if (pB !== pA) return pB - pA;
      return (b._order || 0) - (a._order || 0);
    });

    if (context.trapsFocus) {
      this.focusStack.push(document.activeElement as HTMLElement);
      if (context.container) {
        this.focusFirstElement(context.container!);
      }
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
    const topFocusTrap = this.contextStack.find(
      (c) => c.trapsFocus && c.container,
    );

    if (topFocusTrap && e.key === "Tab") {
      this.handleTabCycle(e, topFocusTrap.container!);
      if (e.defaultPrevented) return;
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
        e.stopPropagation();
        return;
      }
    }
  }

  private handleMouseDown(e: MouseEvent) {
    for (const context of this.contextStack) {
      if (context.handleMouseDown && context.handleMouseDown(e)) {
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

  private isVisible(el: HTMLElement): boolean {
    if (!el.isConnected) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;

    let parent = el.parentElement;
    while (parent) {
      const pStyle = window.getComputedStyle(parent);
      if (pStyle.display === "none" || pStyle.visibility === "hidden")
        return false;
      parent = parent.parentElement;
    }

    return true;
  }

  private getFocusableElements(container: HTMLElement): HTMLElement[] {
    return Array.from(
      container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => {
      const control = el as unknown as { disabled?: boolean };
      if (!control.disabled && this.isVisible(el)) {
        return true;
      }
      return false;
    });
  }

  private focusFirstElement(container: HTMLElement) {
    const focusable = this.getFocusableElements(container);
    if (focusable.length > 0) {
      focusable[0].focus();
    }
  }

  private handleTabCycle(e: KeyboardEvent, container: HTMLElement) {
    const focusableElements = this.getFocusableElements(container);

    if (focusableElements.length === 0) {
      e.preventDefault();
      return;
    }

    let active = document.activeElement as HTMLElement;
    let currentIndex = focusableElements.indexOf(active);

    if (currentIndex === -1 && active) {
      let parent = active.parentElement;
      while (parent && parent !== container) {
        currentIndex = focusableElements.indexOf(parent);
        if (currentIndex !== -1) break;
        parent = parent.parentElement;
      }
    }

    e.preventDefault();
    e.stopPropagation();

    if (e.shiftKey) {
      const prevIndex =
        currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;
      focusableElements[prevIndex].focus();
    } else {
      const nextIndex =
        currentIndex === -1 || currentIndex >= focusableElements.length - 1
          ? 0
          : currentIndex + 1;
      focusableElements[nextIndex].focus();
    }
  }
}
