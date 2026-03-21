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
    loadReplay: vi.fn(),
    forceWin: vi.fn(),
    forceLose: vi.fn(),
    getReplayData: vi.fn().mockReturnValue({ seed: 12345, commands: [] }),
    freezeForDialog: vi.fn(), unfreezeFromDialog: vi.fn(),
    getIsPaused: vi.fn().mockReturnValue(false),
    getTargetScale: vi.fn().mockReturnValue(1.0),
    setTimeScale: vi.fn(),
    getTimeScale: vi.fn().mockReturnValue(1.0),
  })),
}));

vi.mock("@src/renderer/Renderer", () => ({
  Renderer: vi.fn().mockImplementation(() => ({
    render: vi.fn(),
    destroy: vi.fn(),
    setCellSize: vi.fn(),
    setUnitStyle: vi.fn(),
    setOverlay: vi.fn(),
    getCellCoordinates: vi.fn().mockReturnValue({ x: 0, y: 0 }),
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

describe("Regression: voidlock-9uzl HUD Overlap", () => {
  let app: GameApp;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="app">
        <div id="screen-main-menu" class="screen"></div>
        <div id="screen-campaign-shell" style="display:none">
            <div id="campaign-shell-content">
                <div id="screen-campaign" style="display:none"></div>
                <div id="screen-equipment" style="display:none"></div>
                <div id="screen-engineering" style="display:none"></div>
                <div id="screen-statistics" style="display:none"></div>
                <div id="screen-settings" style="display:none"></div>
            </div>
            <div id="campaign-shell-top-bar"></div>
            <div id="campaign-shell-footer"></div>
        </div>
        <div id="screen-mission-setup" style="display:none"></div>
        <div id="screen-mission" class="screen" style="display:none">
            <div id="top-bar"></div>
            <div id="soldier-panel"></div>
            <div id="right-panel"></div>
        </div>
        <div id="screen-debrief" class="screen" style="display:none"></div>
        <div id="screen-campaign-summary" style="display:none"></div>
        <div id="keyboard-help-overlay" style="display:none"></div>
        <div id="squad-builder" style="display:none"></div>
      </div>
    `;

    vi.resetModules();
    const { bootstrap } = await import("@src/renderer/main");
    app = await bootstrap();
    document.dispatchEvent(new Event("DOMContentLoaded"));
  });

  it("should hide mission HUD when debrief screen is shown", async () => {
    const appAny = app as any;
    const mockReport = {
      nodeId: "node-1",
      seed: 12345,
      result: "Won",
      aliensKilled: 10,
      scrapGained: 100,
      intelGained: 5,
      timeSpent: 120000,
      soldierResults: [],
    };

    // Simulate being in mission
    appAny.registry.missionRunner.setMissionHUDVisible(true);
    expect(document.getElementById("top-bar")?.style.display).not.toBe("none");

    // Trigger debrief via the coordinator's callback logic or direct call
    appAny.registry.missionRunner.setMissionHUDVisible(false);
    appAny.registry.navigationOrchestrator.screens.debrief.setReport(mockReport);
    appAny.registry.navigationOrchestrator.switchScreen("debrief", false);

    expect(document.getElementById("top-bar")?.style.display).toBe("none");
    expect(document.getElementById("soldier-panel")?.style.display).toBe(
      "none",
    );
    expect(document.getElementById("right-panel")?.style.display).toBe("none");
    expect(document.getElementById("screen-debrief")?.style.display).toBe(
      "flex",
    );
  });
});
