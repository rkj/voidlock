import { InputDispatcher } from "../InputDispatcher";
import { InputPriority } from "@src/shared/types";
import { UIUtils } from "../utils/UIUtils";

export class MissionSetupScreen {
  private container: HTMLElement;

  constructor(
    containerId: string,
    private onBack: () => void,
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
  }

  public show() {
    this.container.style.display = "flex";
    this.pushInputContext();

    // Auto-focus first input or button
    const firstInput = this.container.querySelector(
      "input, select, button",
    ) as HTMLElement;
    if (firstInput) firstInput.focus();
  }

  public hide() {
    this.container.style.display = "none";
    InputDispatcher.getInstance().popContext("mission-setup");
  }

  private pushInputContext() {
    InputDispatcher.getInstance().pushContext({
      id: "mission-setup",
      priority: InputPriority.UI,
      trapsFocus: true,
      container: this.container,
      handleKeyDown: (e) => this.handleKeyDown(e),
      getShortcuts: () => [
        {
          key: "Arrows",
          label: "Arrows",
          description: "Navigate UI",
          category: "Navigation",
        },
        {
          key: "Enter",
          label: "Enter",
          description: "Select / Activate",
          category: "Navigation",
        },
        {
          key: "ESC",
          label: "Esc",
          description: "Back to Menu",
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
      // Special handling: if we are in an input number or range, maybe we don't want to navigate?
      // But for Mission Setup, mostly we want to navigate.
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === "INPUT" || active.tagName === "SELECT")
      ) {
        // Only navigate if it's NOT a number/range input OR if it's Left/Right on a select
        // Actually, let's keep it simple for now and only navigate if it's NOT a number input
        if (
          (active as HTMLInputElement).type === "number" ||
          (active as HTMLInputElement).type === "range"
        ) {
          // Allow up/down for number inputs
          if (e.key === "ArrowUp" || e.key === "ArrowDown") return false;
        }
      }
      return UIUtils.handleArrowNavigation(e, this.container);
    }

    if (e.key === "Escape") {
      this.onBack();
      return true;
    }

    return false;
  }
}
