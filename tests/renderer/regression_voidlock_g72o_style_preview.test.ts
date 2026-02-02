/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UnitStyle } from "@src/shared/types";

// Mock dependencies
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

const mockGameClient = {
  init: vi.fn(),
  onStateUpdate: vi.fn(),
  addStateUpdateListener: vi.fn(),
  removeStateUpdateListener: vi.fn(),
  stop: vi.fn(),
  getIsPaused: vi.fn().mockReturnValue(false),
  getTargetScale: vi.fn().mockReturnValue(1.0),
  setTimeScale: vi.fn(),
  toggleDebugOverlay: vi.fn(),
  toggleLosOverlay: vi.fn(),
};

vi.mock("@src/engine/GameClient", () => ({
  GameClient: vi.fn().mockImplementation(() => mockGameClient),
}));

vi.mock("@src/renderer/Renderer", () => ({
  Renderer: vi.fn().mockImplementation(() => ({
    render: vi.fn(),
    setCellSize: vi.fn(),
    setUnitStyle: vi.fn(),
    setOverlay: vi.fn(),
  })),
}));

const mockThemeManager = {
  init: vi.fn().mockResolvedValue(undefined),
  setTheme: vi.fn(),
  getColor: vi.fn((varName) => {
    const fallbacks: Record<string, string> = {
      "--color-primary": "#0f0",
      "--color-floor": "#0a0a0a",
      "--color-grid": "#111",
      "--color-black": "#000000",
      "--color-white": "#ffffff",
    };
    return fallbacks[varName] || "#000000";
  }),
  getAssetUrl: vi.fn().mockReturnValue("mock-url"),
};

vi.mock("@src/renderer/ThemeManager", () => ({
  ThemeManager: {
    getInstance: vi.fn().mockReturnValue(mockThemeManager),
  },
}));

vi.mock("@src/renderer/visuals/AssetManager", () => ({
  AssetManager: {
    getInstance: vi.fn().mockReturnValue({
      getUnitSprite: vi.fn().mockReturnValue({
        complete: true,
        naturalWidth: 100,
        onload: null,
      }),
    }),
  },
}));

const mockModalService = {
  alert: vi.fn().mockResolvedValue(undefined),
  confirm: vi.fn().mockResolvedValue(true),
  show: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@src/renderer/ui/ModalService", () => ({
  ModalService: vi.fn().mockImplementation(() => mockModalService),
}));

vi.mock("@src/renderer/campaign/CampaignManager", () => {
  return {
    CampaignManager: {
      getInstance: vi.fn().mockReturnValue({
        getState: vi.fn(() => null),
        load: vi.fn(),
      }),
    },
  };
});

describe("Unit Style Preview Regression (voidlock-g72o)", () => {
  beforeEach(async () => {
    // Mock ResizeObserver
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    // Mock HTMLCanvasElement.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      drawImage: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      setLineDash: vi.fn(),
    });

    document.body.innerHTML = `
      <div id="screen-main-menu" class="screen">
        <button id="btn-menu-custom">Custom Mission</button>
      </div>

      <div id="screen-campaign-shell" class="screen flex-col">
          <div id="campaign-shell-top-bar"></div>
          <div id="campaign-shell-content" class="flex-grow relative overflow-hidden">
              <div id="screen-campaign" class="screen"></div>
              <div id="screen-barracks" class="screen"></div>
              <div id="screen-equipment" class="screen"></div>
              <div id="screen-statistics" class="screen"></div>
              
              <div id="screen-mission-setup" class="screen screen-centered">
                <h1>MISSION CONFIGURATION</h1>
                <div id="mission-setup-context"></div>
                <div id="setup-content">
                  <div id="map-config-section">
                    <select id="map-generator-type"><option value="DenseShip">Dense Ship</option></select>
                    <select id="map-theme"><option value="default">Default</option></select>
                    <select id="select-unit-style">
                        <option value="TacticalIcons">Tactical Icons</option>
                        <option value="Sprites">Sprites</option>
                    </select>
                    <div id="unit-style-preview" class="style-preview-container">
                        <div class="style-preview-item" data-style="TacticalIcons">
                            <div class="style-preview-box">
                                <canvas id="preview-canvas-tactical" width="64" height="64"></canvas>
                            </div>
                            <span class="style-preview-label">Tactical</span>
                        </div>
                        <div class="style-preview-item" data-style="Sprites">
                            <div class="style-preview-box">
                                <canvas id="preview-canvas-sprites" width="64" height="64"></canvas>
                            </div>
                            <span class="style-preview-label">Sprites</span>
                        </div>
                    </div>
                    <input type="number" id="map-seed" />
                    <div id="preset-map-controls">
                       <input type="number" id="map-width" value="10" />
                       <input type="number" id="map-height" value="10" />
                       <input type="range" id="map-spawn-points" value="3" />
                       <input type="range" id="map-starting-threat" value="0" />
                       <input type="range" id="map-base-enemies" value="3" />
                       <input type="range" id="map-enemy-growth" value="1.0" />
                       <input type="checkbox" id="toggle-fog-of-war" checked />
                       <input type="checkbox" id="toggle-debug-overlay" />
                       <input type="checkbox" id="toggle-los-overlay" />
                       <input type="checkbox" id="toggle-agent-control" checked />
                       <input type="checkbox" id="toggle-allow-tactical-pause" checked />
                    </div>
                  </div>
                  <div id="squad-builder"></div>
                  <button id="btn-setup-back">Back</button>
                  <button id="btn-goto-equipment">Equipment</button>
                </div>
              </div>
          </div>
      </div>

      <div id="screen-mission" class="screen">
        <div id="top-bar"></div>
        <div id="soldier-panel"></div>
        <div id="right-panel"></div>
        <canvas id="game-canvas"></canvas>
        <button id="btn-pause-toggle">Pause</button>
        <input type="range" id="game-speed" />
        <span id="speed-value"></span>
      </div>
      <div id="screen-debrief" class="screen"></div>
      <div id="screen-campaign-summary" class="screen"></div>
      <div id="screen-statistics" class="screen"></div>
      <div id="modal-container"></div>
      <input type="range" id="time-scale-slider" />
      <span id="time-scale-value"></span>
    `;

    vi.resetModules();
    await import("@src/renderer/main");
    document.dispatchEvent(new Event("DOMContentLoaded"));
  });

  it("should render both style previews when entering mission setup", async () => {
    document.getElementById("btn-menu-custom")?.click();

    const tacticalCanvas = document.getElementById(
      "preview-canvas-tactical",
    ) as HTMLCanvasElement;
    const spritesCanvas = document.getElementById(
      "preview-canvas-sprites",
    ) as HTMLCanvasElement;

    expect(tacticalCanvas).toBeTruthy();
    expect(spritesCanvas).toBeTruthy();

    const tacticalCtx = tacticalCanvas.getContext("2d");
    const spritesCtx = spritesCanvas.getContext("2d");

    // Verify drawing calls
    expect(tacticalCtx?.arc).toHaveBeenCalled();
    expect(tacticalCtx?.fillText).toHaveBeenCalledWith(
      "1",
      expect.any(Number),
      expect.any(Number),
    );

    expect(spritesCtx?.drawImage).toHaveBeenCalled();
    expect(spritesCtx?.fillText).toHaveBeenCalledWith(
      "1",
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("should update active state when unit style selection changes", async () => {
    document.getElementById("btn-menu-custom")?.click();

    const styleSelect = document.getElementById(
      "select-unit-style",
    ) as HTMLSelectElement;
    const tacticalItem = document.querySelector(
      ".style-preview-item[data-style='TacticalIcons']",
    );
    const spritesItem = document.querySelector(
      ".style-preview-item[data-style='Sprites']",
    );

    // Default should be TacticalIcons (from config manager mock)
    // Wait, in my test I didn't mock ConfigManager to return TacticalIcons specifically, but it defaults to it.

    styleSelect.value = UnitStyle.Sprites;
    styleSelect.dispatchEvent(new Event("change"));

    expect(spritesItem?.classList.contains("active")).toBe(true);
    expect(tacticalItem?.classList.contains("active")).toBe(false);

    styleSelect.value = UnitStyle.TacticalIcons;
    styleSelect.dispatchEvent(new Event("change"));

    expect(tacticalItem?.classList.contains("active")).toBe(true);
    expect(spritesItem?.classList.contains("active")).toBe(false);
  });
});
