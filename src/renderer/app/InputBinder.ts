import { AppContext } from "./AppContext";
import { TimeUtility } from "@src/renderer/TimeUtility";
import { MapGeneratorType, UnitStyle, MissionType } from "@src/shared/types";

/**
 * InputBinder is responsible for attaching and detaching DOM event listeners.
 * it separates the "how" (DOM events) from the "what" (application logic).
 */
export class InputBinder {
  private handlers: Map<
    HTMLElement,
    { type: string; handler: (e: Event) => void }[]
  > = new Map();

  constructor(private context: AppContext) {}

  public bindAll(callbacks: {
    onTogglePause: () => void;
    onAbortMission: () => void;
    onCustomMission: () => void;
    onCampaignMenu: () => void;
    onResetData: () => void;
    onShowEquipment: () => void;
    onLoadStaticMap: (json: string) => void;
    onUploadStaticMap: (file: File) => void;
    onConvertAscii: (ascii: string) => void;
    onExportReplay: () => void;
    onShowStatistics: () => void;
    onSetupBack: () => void;
    onUnitStyleChange: (style: UnitStyle) => void;
    onThemeChange: (themeId: string) => void;
    onMapGeneratorChange: (type: MapGeneratorType) => void;
    onMissionTypeChange: (type: MissionType) => void;
    onToggleFog: (enabled: boolean) => void;
    onToggleDebug: (enabled: boolean) => void;
    onToggleLos: (enabled: boolean) => void;
    onToggleAi: (enabled: boolean) => void;
    onTogglePauseAllowed: (enabled: boolean) => void;
    onMapSizeChange: (width: number, height: number) => void;
  }) {
    const { context } = this;
    // Main Menu
    this.addListener("btn-menu-custom", "click", () =>
      callbacks.onCustomMission(),
    );
    this.addListener("btn-menu-campaign", "click", () =>
      callbacks.onCampaignMenu(),
    );
    this.addListener("btn-menu-statistics", "click", () =>
      callbacks.onShowStatistics(),
    );
    this.addListener("btn-menu-reset", "click", () => callbacks.onResetData());

    // Navigation Back
    this.addListener("btn-campaign-back", "click", () =>
      context.screenManager.goBack(),
    );
    this.addListener("btn-setup-back", "click", () => callbacks.onSetupBack());
    this.addListener("btn-give-up", "click", async () => {
      if (
        await context.modalService.confirm("Abort Mission and return to menu?")
      ) {
        callbacks.onAbortMission();
      }
    });

    // Mission Setup -> Equipment
    this.addListener("btn-goto-equipment", "click", () =>
      callbacks.onShowEquipment(),
    );

    // Speed Controls
    this.addListener("btn-pause-toggle", "click", () =>
      callbacks.onTogglePause(),
    );

    const gameSpeedSlider = document.getElementById(
      "game-speed",
    ) as HTMLInputElement;
    this.addListener(gameSpeedSlider, "input", () => {
      const scale = TimeUtility.sliderToScale(
        parseFloat(gameSpeedSlider.value),
      );
      context.gameClient.setTimeScale(scale);
      // NOTE: main.ts calls syncSpeedUI() here indirectly or directly.
      // We might need to expose syncSpeedUI or pass it in.
    });

    // Mission Setup Inputs
    this.addInputListener("map-starting-threat", "map-starting-threat-value");
    this.addInputListener("map-base-enemies", "map-base-enemies-value");
    this.addInputListener("map-enemy-growth", "map-enemy-growth-value");

    const spInput = document.getElementById(
      "map-spawn-points",
    ) as HTMLInputElement;
    const spValue = document.getElementById("map-spawn-points-value");
    this.addListener(spInput, "input", () => {
      if (spValue) spValue.textContent = spInput.value;
    });

    const wInput = document.getElementById("map-width") as HTMLInputElement;
    const hInput = document.getElementById("map-height") as HTMLInputElement;
    const updateSpawnPoints = () => {
      const w = parseInt(wInput?.value || "0");
      const h = parseInt(hInput?.value || "0");
      callbacks.onMapSizeChange(w, h);
    };
    this.addListener(wInput, "input", updateSpawnPoints);
    this.addListener(hInput, "input", updateSpawnPoints);

    // Map Generator & Mission Type
    this.addListener("map-generator-type", "change", (e: Event) => {
      const target = e.target as HTMLSelectElement;
      const val = target.value as MapGeneratorType;
      callbacks.onMapGeneratorChange(val);

      const isStatic = val === MapGeneratorType.Static;
      const staticControls = document.getElementById("static-map-controls");
      if (staticControls)
        staticControls.style.display = isStatic ? "block" : "none";
      const sInput = document.getElementById("map-seed") as HTMLInputElement;
      if (wInput) wInput.disabled = isStatic;
      if (hInput) hInput.disabled = isStatic;
      if (sInput) sInput.disabled = isStatic;
    });

    this.addListener("mission-type", "change", (e: Event) => {
      const target = e.target as HTMLSelectElement;
      callbacks.onMissionTypeChange(target.value as MissionType);
    });

    this.addListener("map-theme", "change", (e: Event) => {
      const target = e.target as HTMLSelectElement;
      callbacks.onThemeChange(target.value);
    });

    // Toggles
    this.addToggleListener("toggle-fog-of-war", (checked) => {
      callbacks.onToggleFog(checked);
    });
    this.addToggleListener("toggle-debug-overlay", (checked) => {
      callbacks.onToggleDebug(checked);
    });
    this.addToggleListener("toggle-los-overlay", (checked) => {
      callbacks.onToggleLos(checked);
    });
    this.addToggleListener("toggle-agent-control", (checked) => {
      callbacks.onToggleAi(checked);
    });
    this.addToggleListener("toggle-allow-tactical-pause", (checked) => {
      callbacks.onTogglePauseAllowed(checked);
    });

    this.addListener("select-unit-style", "change", (e: Event) => {
      const target = e.target as HTMLSelectElement;
      callbacks.onUnitStyleChange(target.value as UnitStyle);
    });

    const tsSlider = document.getElementById(
      "time-scale-slider",
    ) as HTMLInputElement;
    const tsValue = document.getElementById("time-scale-value");
    this.addListener(tsSlider, "input", () => {
      const scale = TimeUtility.sliderToScale(parseFloat(tsSlider.value));
      if (tsValue) tsValue.textContent = scale.toFixed(1);
      context.gameClient.setTimeScale(scale);
    });

    // Static Map & Replay
    this.addListener("load-static-map", "click", () => {
      const json = (
        document.getElementById("static-map-json") as HTMLTextAreaElement
      ).value;
      callbacks.onLoadStaticMap(json);
    });

    this.addListener("upload-static-map", "change", (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) callbacks.onUploadStaticMap(file);
    });

    this.addListener("convert-ascii-to-map", "click", () => {
      const ascii = (
        document.getElementById("ascii-map-input") as HTMLTextAreaElement
      ).value;
      callbacks.onConvertAscii(ascii);
    });

    this.addListener("export-replay", "click", () =>
      callbacks.onExportReplay(),
    );
  }

  private addListener(
    idOrEl: string | HTMLElement | null,
    type: string,
    handler: (e: Event) => void,
  ) {
    const el =
      typeof idOrEl === "string" ? document.getElementById(idOrEl) : idOrEl;
    if (!el) return;
    el.addEventListener(type, handler);
    let entries = this.handlers.get(el) || [];
    entries.push({ type, handler });
    this.handlers.set(el, entries);
  }

  private addInputListener(id: string, valueId: string) {
    const input = document.getElementById(id) as HTMLInputElement;
    const display = document.getElementById(valueId);
    if (input && display) {
      this.addListener(input, "input", () => {
        display.textContent = input.value;
      });
    }
  }

  private addToggleListener(id: string, callback: (checked: boolean) => void) {
    const el = document.getElementById(id) as HTMLInputElement;
    if (el) {
      this.addListener(el, "change", (e: Event) => {
        const target = e.target as HTMLInputElement;
        callback(target.checked);
      });
    }
  }

  public unbindAll() {
    this.handlers.forEach((entries, el) => {
      entries.forEach(({ type, handler }) => {
        el.removeEventListener(type, handler);
      });
    });
    this.handlers.clear();
  }
}
