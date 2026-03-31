import type { InputDispatcher } from "../InputDispatcher";
import { InputPriority } from "@src/shared/types";
import { UIUtils } from "../utils/UIUtils";
import { t, applyLocale } from "../i18n";
import { I18nKeys } from "../i18n/keys";

export interface MissionSetupScreenConfig {
  containerId: string;
  inputDispatcher: InputDispatcher;
  onBack: () => void;
}

export class MissionSetupScreen {
  private container: HTMLElement;
  private inputDispatcher: InputDispatcher;
  private onBack: () => void;

  constructor(config: MissionSetupScreenConfig) {
    const el = document.getElementById(config.containerId);
    if (!el) throw new Error(`Container #${config.containerId} not found`);
    this.container = el;
    this.inputDispatcher = config.inputDispatcher;
    this.onBack = config.onBack;
  }

  public show() {
    this.container.style.display = "flex";
    this.localize();
    this.pushInputContext();

    // Auto-focus first input or button
    const firstInput = this.container.querySelector(
      "input, select, button",
    ) as HTMLElement;
    if (firstInput) firstInput.focus();
  }

  public hide() {
    this.container.style.display = "none";
    this.inputDispatcher.popContext("mission-setup");
  }

  private localize() {
    applyLocale();

    // Start Button (some special handling might be needed if it was btn-start-mission)
    const startBtn = this.container.querySelector("#btn-launch-mission");
    if (startBtn) startBtn.textContent = t(I18nKeys.hud.start_mission);
    
    // Back Button
    const backBtn = this.container.querySelector("#btn-setup-back");
    if (backBtn) backBtn.textContent = t(I18nKeys.common.back);
  }

  private pushInputContext() {
    this.inputDispatcher.pushContext({
      id: "mission-setup",
      priority: InputPriority.UI,
      trapsFocus: true,
      container: this.container,
      handleKeyDown: (e) => this.handleKeyDown(e),
      getShortcuts: () => [
        {
          key: "Arrows",
          label: t(I18nKeys.common.shortcuts.navigate),
          description: t(I18nKeys.common.shortcuts.move_selection),
          category: "Navigation",
        },
        {
          key: "Enter",
          label: t(I18nKeys.common.shortcuts.select),
          description: t(I18nKeys.common.shortcuts.activate_button),
          category: "Navigation",
        },
        {
          key: "ESC",
          label: t(I18nKeys.common.back),
          description: t(I18nKeys.common.shortcuts.save_return),
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
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === "INPUT" || active.tagName === "SELECT")
      ) {
        if (
          (active as HTMLInputElement).type === "number" ||
          (active as HTMLInputElement).type === "range"
        ) {
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
