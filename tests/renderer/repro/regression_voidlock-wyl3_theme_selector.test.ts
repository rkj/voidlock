/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GameApp } from "@src/renderer/app/GameApp";
import { ConfigManager } from "@src/renderer/ConfigManager";
import { ThemeManager } from "@src/renderer/ThemeManager";
import { UnitStyle } from "@src/shared/types";

// Mock Worker
global.Worker = vi.fn().mockImplementation(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  postMessage: vi.fn(),
  terminate: vi.fn(),
}));

describe("Theme Selector", () => {
  let app: GameApp;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="app">
        <div id="screen-main-menu" class="screen">
            <button id="btn-menu-campaign"></button>
            <button id="btn-menu-custom"></button>
            <button id="btn-menu-statistics"></button>
            <button id="btn-menu-settings"></button>
            <button id="btn-menu-reset"></button>
            <input type="file" id="import-replay" />
            <div id="menu-version"></div>
        </div>
        <div id="screen-campaign-shell" class="screen">
            <div id="campaign-shell-top-bar"></div>
            <div id="campaign-shell-content">
              <div id="screen-engineering" class="screen" style="display:none"></div>
                <div id="screen-campaign" class="screen"></div>
                <div id="screen-equipment" class="screen"></div>
                <div id="screen-barracks" class="screen"></div>
                <div id="screen-statistics" class="screen"></div>
                <div id="screen-settings" class="screen"></div>
                <div id="screen-mission-setup" class="screen">
                    <div id="mission-setup-context"></div>
                    <div id="setup-content">
                        <div id="unit-style-preview"></div>
                        <div id="map-config-section">
                            <div class="control-group">
                                <select id="map-generator-type">
                                    <option value="Procedural">Procedural</option>
                                    <option value="Static">Static Map</option>
                                </select>
                            </div>
                            <div class="control-group">
                                <select id="map-theme">
                                    <option value="default">Default</option>
                                    <option value="industrial">Industrial</option>
                                    <option value="hive">Hive</option>
                                </select>
                            </div>
                            <div id="preset-map-controls">
                                <input type="number" id="map-seed" />
                                <input type="number" id="map-width" />
                                <input type="number" id="map-height" />
                                <input type="range" id="map-spawn-points" />
                                <span id="map-spawn-points-value"></span>
                                <input type="range" id="map-starting-threat" />
                                <span id="map-starting-threat-value"></span>
                                <input type="range" id="map-base-enemies" />
                                <span id="map-base-enemies-value"></span>
                                <input type="range" id="map-enemy-growth" />
                                <span id="map-enemy-growth-value"></span>
                            </div>
                        </div>
                        <div id="squad-builder"></div>
                    </div>
                    <button id="btn-setup-back"></button>
                    <button id="btn-goto-equipment"></button>
                </div>
            </div>
        </div>
        <div id="screen-mission" class="screen">
            <div id="top-bar">
                <div id="game-status"></div>
                <div id="top-threat-fill"></div>
                <div id="top-threat-value"></div>
                <button id="btn-pause-toggle"></button>
                <input type="range" id="game-speed" />
                <span id="speed-value"></span>
                <button id="btn-give-up"></button>
            </div>
            <div id="soldier-panel"><div id="soldier-list"></div></div>
            <div id="mission-body">
                <div id="game-container"><canvas id="game-canvas"></canvas></div>
                <div id="right-panel"></div>
            </div>
        </div>
        <div id="screen-debrief" class="screen"></div>
        <div id="screen-campaign-summary" class="screen"></div>
        <div id="modal-container"></div>
      </div>
    `;

    // Mock ThemeManager init to avoid fetch
    vi.spyOn(ThemeManager.prototype, "init").mockResolvedValue(undefined);

    localStorage.clear();
    app = new GameApp();
    await app.initialize();
  });

  it("should initialize with default theme", () => {
    document.getElementById("btn-menu-settings")?.click();
    const themeSelect = document.getElementById(
      "settings-map-theme",
    ) as HTMLSelectElement;
    expect(themeSelect.value).toBe("default");
    expect(document.body.classList.contains("theme-default")).toBe(true);
  });

  it("should apply and persist theme change", () => {
    document.getElementById("btn-menu-settings")?.click();
    const themeSelect = document.getElementById(
      "settings-map-theme",
    ) as HTMLSelectElement;

    // Change theme to industrial
    themeSelect.value = "industrial";
    themeSelect.dispatchEvent(new Event("change"));

    expect(document.body.classList.contains("theme-industrial")).toBe(true);

    // Check if it's saved in ConfigManager
    const global = ConfigManager.loadGlobal();
    expect(global.themeId).toBe("industrial");
  });

  it("should load persisted theme on initialization", async () => {
    // Persist industrial theme
    const defaults = ConfigManager.getDefault();
    ConfigManager.saveGlobal({
      ...ConfigManager.loadGlobal(),
      unitStyle: UnitStyle.TacticalIcons,
      themeId: "hive",
    });
    ConfigManager.saveCustom(defaults);

    // Re-initialize app
    const newApp = new GameApp();
    await newApp.initialize();

    document.getElementById("btn-menu-settings")?.click();
    const themeSelect = document.getElementById(
      "settings-map-theme",
    ) as HTMLSelectElement;
    expect(themeSelect.value).toBe("hive");
    expect(document.body.classList.contains("theme-hive")).toBe(true);
  });
});
