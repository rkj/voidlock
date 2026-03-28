import type { InputDispatcher } from "../InputDispatcher";
import { InputPriority } from "@src/shared/types";
import { UIUtils } from "../utils/UIUtils";
import { t } from "../i18n";
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
    // Header
    const title = this.container.querySelector("#mission-setup-title");
    if (title) title.textContent = t(I18nKeys.screen.mission_setup.title);

    // Map Generator
    const genLabel = this.container.querySelector("label[for=map-generator-type]");
    if (genLabel) genLabel.textContent = t(I18nKeys.screen.mission_setup.generator_label);

    const genSelect = this.container.querySelector("#map-generator-type") as HTMLSelectElement;
    if (genSelect) {
      const options = genSelect.options;
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        if (opt.value === "DenseShip") opt.textContent = t(I18nKeys.screen.mission_setup.gen_dense);
        else if (opt.value === "TreeShip") opt.textContent = t(I18nKeys.screen.mission_setup.gen_tree);
        else if (opt.value === "Procedural") opt.textContent = t(I18nKeys.screen.mission_setup.gen_procedural);
        else if (opt.value === "Static") opt.textContent = t(I18nKeys.screen.mission_setup.gen_static);
      }
    }

    // Mission Type
    const typeLabel = this.container.querySelector("label[for=mission-type]");
    if (typeLabel) typeLabel.textContent = t(I18nKeys.mission.type.label);

    const typeSelect = this.container.querySelector("#mission-type") as HTMLSelectElement;
    if (typeSelect) {
      const options = typeSelect.options;
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        if (opt.value === "Default") opt.textContent = t(I18nKeys.mission.type.default);
        else if (opt.value === "RecoverIntel") opt.textContent = t(I18nKeys.mission.type.recover_intel);
        else if (opt.value === "ExtractArtifacts") opt.textContent = t(I18nKeys.mission.type.extract_artifacts);
        else if (opt.value === "DestroyHive") opt.textContent = t(I18nKeys.mission.type.destroy_hive);
        else if (opt.value === "EscortVIP") opt.textContent = t(I18nKeys.mission.type.escort_vip);
      }
    }

    // Game Options
    const optionsLabel = this.container.querySelector(".control-group:nth-child(3) label");
    if (optionsLabel && !optionsLabel.getAttribute("for")) {
      optionsLabel.textContent = t(I18nKeys.screen.mission_setup.game_options);
    }

    const fogLabel = this.container.querySelector("label:has(#toggle-fog-of-war)");
    if (fogLabel) {
      const input = fogLabel.querySelector("input");
      fogLabel.textContent = "";
      if (input) fogLabel.appendChild(input);
      fogLabel.appendChild(document.createTextNode(t(I18nKeys.screen.mission_setup.fog_of_war)));
    }

    const debugLabel = this.container.querySelector("label:has(#toggle-debug-overlay)");
    if (debugLabel) {
      const input = debugLabel.querySelector("input");
      debugLabel.textContent = "";
      if (input) debugLabel.appendChild(input);
      debugLabel.appendChild(document.createTextNode(t(I18nKeys.screen.mission_setup.debug_overlay)));
    }

    // Start Button
    const startBtn = this.container.querySelector("#btn-start-mission");
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
