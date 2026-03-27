import type { InputDispatcher } from "../InputDispatcher";
import { InputPriority } from "@src/shared/types";
import { UIUtils } from "../utils/UIUtils";

export class MainMenuScreen {
  private container: HTMLElement;
  private hasPlayedTitleSplash = false;
  private splashTimer: number | null = null;

  constructor(
    containerId: string,
    private inputDispatcher: InputDispatcher,
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
  }

  public show() {
    this.container.style.display = "flex";
    this.container.scrollTop = 0;
    const hasSplash = this.container.querySelector(".title-splash");
    if (hasSplash) {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // Disable splash in E2E or if reduced motion is preferred
      const isE2E = (window as unknown as Record<string, boolean>).isE2E || navigator.userAgent.includes("Puppeteer") || navigator.userAgent.includes("HeadlessChrome");
      
      if (!this.hasPlayedTitleSplash && !prefersReducedMotion && !isE2E) {
        this.hasPlayedTitleSplash = true;
        this.container.classList.remove("title-splash-complete");
        this.container.classList.add("title-splash-active");
        this.splashTimer = window.setTimeout(() => {
          this.container.classList.remove("title-splash-active");
          this.container.classList.add("title-splash-complete");
          this.splashTimer = null;
          // Re-focus after splash completes to ensure keyboard navigation is ready
          const firstBtn = this.container.querySelector("button");
          if (firstBtn instanceof HTMLElement) {
            firstBtn.focus();
          }
        }, 1900);
      } else {
        this.hasPlayedTitleSplash = true;
        this.container.classList.remove("title-splash-active");
        this.container.classList.add("title-splash-complete");
      }
    }

    this.pushInputContext();

    // Auto-focus first button
    const firstBtn = this.container.querySelector("button");
    if (firstBtn instanceof HTMLElement) {
      try {
        firstBtn.focus({ preventScroll: true });
      } catch {
        firstBtn.focus();
      }
    }
  }

  public hide() {
    this.container.style.display = "none";
    if (this.splashTimer !== null) {
      window.clearTimeout(this.splashTimer);
      this.splashTimer = null;
      this.container.classList.remove("title-splash-active");
      this.container.classList.add("title-splash-complete");
    }
    this.inputDispatcher.popContext("main-menu");
  }

  private pushInputContext() {
    this.inputDispatcher.pushContext({
      id: "main-menu",
      priority: InputPriority.UI,
      trapsFocus: true,
      container: this.container,
      handleKeyDown: (e) => this.handleKeyDown(e),
      getShortcuts: () => [
        {
          key: "Arrows",
          label: "Navigate",
          description: "Move selection",
          category: "Navigation",
        },
        {
          key: "Enter",
          label: "Select",
          description: "Activate button",
          category: "Navigation",
        },
      ],
    });
  }

  private handleKeyDown(e: KeyboardEvent): boolean {
    if (
      e.key === "ArrowDown" ||
      e.key === "ArrowUp" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight"
    ) {
      return UIUtils.handleArrowNavigation(e, this.container, {
        orientation: "vertical",
      });
    }

    return false;
  }
}
