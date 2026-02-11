import { InputDispatcher } from "../InputDispatcher";
import { InputPriority } from "@src/shared/types";
import { UIUtils } from "../utils/UIUtils";

export class MainMenuScreen {
  private container: HTMLElement;

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
  }

  public show() {
    this.container.style.display = "flex";
    this.pushInputContext();

    // Auto-focus first button
    const firstBtn = this.container.querySelector("button");
    if (firstBtn) firstBtn.focus();
  }

  public hide() {
    this.container.style.display = "none";
    InputDispatcher.getInstance().popContext("main-menu");
  }

  private pushInputContext() {
    InputDispatcher.getInstance().pushContext({
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
