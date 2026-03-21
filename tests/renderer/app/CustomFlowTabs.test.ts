/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameApp } from "@src/renderer/app/GameApp";

// Mock dependencies
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

vi.mock("@src/engine/GameClient", () => ({
  GameClient: vi.fn().mockImplementation(() => ({
    onStateUpdate: vi.fn(),
    queryState: vi.fn(),
    addStateUpdateListener: vi.fn(),
    removeStateUpdateListener: vi.fn(),
    init: vi.fn(), pause: vi.fn(), resume: vi.fn(),
    stop: vi.fn(),
    freezeForDialog: vi.fn(), unfreezeFromDialog: vi.fn(),
    getIsPaused: vi.fn().mockReturnValue(false),
    getTargetScale: vi.fn().mockReturnValue(1.0),
    setTimeScale: vi.fn(),
    getTimeScale: vi.fn().mockReturnValue(1.0),
  })),
}));

vi.mock("@src/renderer/Renderer", () => ({
  Renderer: vi.fn().mockImplementation(() => ({
    destroy: vi.fn(),
  })),
}));

vi.mock("@src/renderer/ThemeManager", () => {
  const mockInstance = {
    init: vi.fn().mockResolvedValue(undefined),
    setTheme: vi.fn(),
    getAssetUrl: vi.fn().mockReturnValue("mock-url"),
    getColor: vi.fn().mockReturnValue("#000"),
    getIconUrl: vi.fn().mockReturnValue("mock-icon-url"),
    getCurrentThemeId: vi.fn().mockReturnValue("default"),
    applyTheme: vi.fn(),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  (mockConstructor as any).getInstance = vi.fn().mockReturnValue(mockInstance);
  return {
    ThemeManager: mockConstructor,
  };
});

vi.mock("@src/renderer/visuals/AssetManager", () => {
  const mockInstance = {
    loadSprites: vi.fn(),
    getUnitSprite: vi.fn(),
    getEnemySprite: vi.fn(),
    getMiscSprite: vi.fn(),
    getIcon: vi.fn(),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  (mockConstructor as any).getInstance = vi.fn().mockReturnValue(mockInstance);
  return {
    AssetManager: mockConstructor,
  };
});

describe("Custom Flow Tabs Integration", () => {
  let app: GameApp;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="app">
        <div id="screen-main-menu" class="screen">
          <button id="btn-menu-campaign">Campaign</button>
          <button id="btn-menu-custom">Custom Mission</button>
          <p id="menu-version"></p>
        </div>

        <div id="screen-campaign-shell" class="screen flex-col" style="display:none">
          <div id="campaign-shell-top-bar"></div>
          <div id="campaign-shell-content">
            <div id="screen-campaign" class="screen" style="display:none"></div>
            <div id="screen-equipment" class="screen" style="display:none"></div>
            <div id="screen-engineering" class="screen" style="display:none"></div>
            <div id="screen-statistics" class="screen" style="display:none"></div>
            <div id="screen-settings" class="screen" style="display:none"></div>
          </div>
          <div id="campaign-shell-footer"></div>
        </div>

        <div id="screen-mission-setup" class="screen h-full" style="display:none">
            <div id="unit-style-preview"></div>
            <div id="squad-builder"></div>
            <button id="btn-launch-mission">Launch</button>
            <button id="btn-goto-equipment">Equipment</button>
            <button id="btn-setup-back">Back</button>
            <select id="map-generator-type"><option value="DenseShip">Dense</option></select>
            <select id="mission-type"><option value="Default">Default</option></select>
            <input type="checkbox" id="toggle-fog-of-war" checked />
            <input type="checkbox" id="toggle-debug-overlay" />
            <input type="checkbox" id="toggle-los-overlay" />
            <input type="checkbox" id="toggle-agent-control" checked />
            <input type="checkbox" id="toggle-manual-deployment" />
            <input type="checkbox" id="toggle-allow-tactical-pause" checked />
            <input type="number" id="map-width" value="10" />
            <input type="number" id="map-height" value="10" />
            <input type="number" id="map-spawn-points" value="3" />
            <input type="range" id="map-starting-threat" value="0" />
            <input type="range" id="map-base-enemies" value="3" />
            <input type="range" id="map-enemy-growth" value="1" />
        </div>
        <div id="screen-mission" class="screen" style="display:none">
            <div id="right-panel"></div>
        </div>
        <div id="screen-debrief" class="screen" style="display:none"></div>
        <div id="screen-campaign-summary" class="screen" style="display:none"></div>
        <div id="keyboard-help-overlay" style="display:none"></div>
      </div>
    `;

    vi.resetModules();
    const { bootstrap } = await import("@src/renderer/main");
    app = await bootstrap();
    document.dispatchEvent(new Event("DOMContentLoaded"));
  });

  it("should switch to setup screen when setup tab is clicked in custom mode", async () => {
    // Start custom mission via click
    const customBtn = document.getElementById("btn-menu-custom");
    customBtn?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify we are on mission-setup
    expect(
      document.getElementById("screen-mission-setup")?.style.display,
    ).not.toBe("none");

    // Click Settings tab
    const shell = (app as any).registry.campaignShell;
    shell.onTabChange("settings");
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify we are on settings screen
    expect(document.getElementById("screen-settings")?.style.display).not.toBe(
      "none",
    );
    expect(document.getElementById("screen-mission-setup")?.style.display).toBe(
      "none",
    );

    // Click Setup tab
    shell.onTabChange("setup");
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify we are back on mission-setup
    expect(
      document.getElementById("screen-mission-setup")?.style.display,
    ).not.toBe("none");
    expect(document.getElementById("screen-settings")?.style.display).toBe(
      "none",
    );
  });

  it("should keep custom mode (tabs visible) when switching to stats in custom flow", async () => {
    // Start custom mission
    const customBtn = document.getElementById("btn-menu-custom");
    customBtn?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Click Service Record tab
    const shell = (app as any).registry.campaignShell;
    shell.onTabChange("stats");
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify we are on statistics screen
    expect(
      document.getElementById("screen-statistics")?.style.display,
    ).not.toBe("none");

    // Verify shell is still in custom mode (has Protocol tab)
    const shellContainer = document.getElementById("screen-campaign-shell")!;
    const buttons = Array.from(shellContainer.querySelectorAll("button"));
    const labels = buttons.map((b) => b.textContent);
    expect(labels).toContain("Protocol");
  });
});
