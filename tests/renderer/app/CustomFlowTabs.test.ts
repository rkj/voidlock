/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameApp } from "@src/renderer/app/GameApp";
import { ConfigManager } from "@src/renderer/ConfigManager";
import { ThemeManager } from "@src/renderer/ThemeManager";

// Mock dependencies that are hard to initialize in JSDOM
vi.mock("@src/renderer/ThemeManager", () => ({
  ThemeManager: {
    getInstance: () => ({
      init: vi.fn().mockResolvedValue(undefined),
      setTheme: vi.fn(),
      applyTheme: vi.fn(),
      getCurrentThemeId: vi.fn().mockReturnValue("default"),
      getIconUrl: vi.fn().mockReturnValue("mock-url"),
      getAssetUrl: vi.fn().mockReturnValue("mock-url"),
      getColor: vi.fn().mockReturnValue("#000"),
    }),
  },
}));

vi.mock("@src/renderer/visuals/AssetManager", () => ({
  AssetManager: {
    getInstance: () => ({
      loadSprites: vi.fn(),
    }),
  },
}));

vi.mock("@src/engine/GameClient", () => ({
  GameClient: vi.fn().mockImplementation(() => ({
    onStateUpdate: vi.fn(),
  queryState: vi.fn(),
    addStateUpdateListener: vi.fn(),
    removeStateUpdateListener: vi.fn(),
    stop: vi.fn(),
    getIsPaused: vi.fn().mockReturnValue(false),
    getTargetScale: vi.fn().mockReturnValue(1.0),
  getTimeScale: vi.fn().mockReturnValue(1.0),
    getReplayData: vi.fn().mockReturnValue({ seed: 123, commandLog: [] }),
    toggleDebugOverlay: vi.fn(),
    toggleLosOverlay: vi.fn(),
    setTimeScale: vi.fn(),
  })),
}));

vi.mock("@src/renderer/visuals/GameRenderer", () => ({
  GameRenderer: vi.fn().mockImplementation(() => ({
    render: vi.fn(),
    setCellSize: vi.fn(),
    getCellCoordinates: vi.fn().mockReturnValue({ x: 0, y: 0 }),
  })),
}));

describe("Custom Flow Tabs Integration", () => {
  let app: GameApp;

  beforeEach(async () => {
    // Setup minimal DOM
    document.body.innerHTML = `
      <div id="btn-menu-custom"></div>
      <div id="screen-campaign-shell"></div>
      <div id="screen-main-menu"></div>
      <div id="screen-mission-setup">
        <div id="squad-builder"></div>
      </div>
      <div id="screen-settings"></div>
      <div id="screen-statistics"></div>
      <div id="screen-campaign"></div>
      <div id="screen-barracks"></div>
      <div id="screen-debrief"></div>
      <div id="screen-equipment"></div>
      <div id="screen-campaign-summary"></div>
      <div id="screen-engineering"></div>
      <div id="game-container"></div>
      <div id="top-bar"></div>
      <div id="soldier-panel"></div>
      <div id="right-panel"></div>
      <div id="menu-version"></div>
      <input id="game-speed" type="range" />
      <input id="time-scale-slider" type="range" />
    `;

    // Mock ConfigManager
    vi.spyOn(ConfigManager, "loadGlobal").mockReturnValue({
      logLevel: "NONE",
      themeId: "default",
      debugSnapshotInterval: 100,
      showScanlines: true,
      uiScale: 1.0,
      allowCloudSync: false,
    } as any);

    app = new GameApp();
    await app.initialize();
  });

  it("should switch to setup screen when setup tab is clicked in custom mode", async () => {
    // Start custom mission via click
    const customBtn = document.getElementById("btn-menu-custom");
    customBtn?.click();

    // Verify we are on mission-setup
    expect(
      document.getElementById("screen-mission-setup")?.style.display,
    ).not.toBe("none");

    // Click Settings tab
    const shell = (app as any).registry.campaignShell;
    shell.onTabChange("settings");

    // Verify we are on settings screen
    expect(document.getElementById("screen-settings")?.style.display).not.toBe(
      "none",
    );
    expect(document.getElementById("screen-mission-setup")?.style.display).toBe(
      "none",
    );

    // Click Setup tab
    shell.onTabChange("setup");

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

    // Click Service Record tab
    const shell = (app as any).registry.campaignShell;
    shell.onTabChange("stats");

    // Verify we are on statistics screen
    expect(
      document.getElementById("screen-statistics")?.style.display,
    ).not.toBe("none");

    // Verify shell is still in custom mode (has Setup tab)
    const shellContainer = document.getElementById("screen-campaign-shell")!;
    const buttons = Array.from(shellContainer.querySelectorAll("button"));
    const labels = buttons.map((b) => b.textContent);
    expect(labels).toContain("Setup");
  });
});
