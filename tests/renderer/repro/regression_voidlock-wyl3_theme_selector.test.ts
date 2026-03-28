/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameApp } from "@src/renderer/app/GameApp";
import { ConfigManager } from "@src/renderer/ConfigManager";

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
    render: vi.fn(),
    destroy: vi.fn(),
    setCellSize: vi.fn(),
    setUnitStyle: vi.fn(),
    setOverlay: vi.fn(),
    getCellCoordinates: vi.fn().mockReturnValue({ x: 0, y: 0 }),
  })),
}));

// Mock CampaignManager
let mockCampaignState: any = null;
vi.mock("@src/renderer/campaign/CampaignManager", () => {
  const mockInstance = {
    getState: vi.fn(() => mockCampaignState),
    selectNode: vi.fn(),
    getStorage: vi.fn().mockReturnValue({
        getCloudSync: vi.fn().mockReturnValue({
            initialize: vi.fn().mockResolvedValue(undefined),
            setEnabled: vi.fn(),
        }),
        load: vi.fn(),
    }),
    getSyncStatus: vi.fn().mockReturnValue("local-only"),
    addChangeListener: vi.fn(),
    removeChangeListener: vi.fn(),
    load: vi.fn(),
    save: vi.fn(),
    assignEquipment: vi.fn(),
    reconcileMission: vi.fn(),
    startNewCampaign: vi.fn(),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  (mockConstructor as any).getInstance = vi.fn().mockReturnValue(mockInstance);
  return {
    CampaignManager: mockConstructor,
  };
});

describe("Theme Selector Regression", () => {
  let app: GameApp;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="app">
        <div id="screen-main-menu" class="screen">
          <button id="btn-menu-settings">Settings</button>
        </div>
        <div id="screen-campaign-shell" style="display:none">
            <div id="campaign-shell-top-bar"></div>
            <div id="campaign-shell-content">
                <div id="screen-campaign" style="display:none"></div>
                <div id="screen-equipment" style="display:none"></div>
                <div id="screen-engineering" style="display:none"></div>
                <div id="screen-statistics" style="display:none"></div>
                <div id="screen-settings" class="screen" style="display:none">
                    <select id="settings-map-theme">
                        <option value="default">Default</option>
                        <option value="industrial">Industrial</option>
                        <option value="hive">Hive</option>
                    </select>
                    <div id="unit-style-preview"></div>
                </div>
            </div>
            <div id="campaign-shell-footer"></div>
        </div>
        <div id="screen-mission-setup" style="display:none"></div>
        <div id="screen-mission" style="display:none"></div>
        <div id="screen-debrief" style="display:none"></div>
        <div id="screen-campaign-summary" style="display:none"></div>
        <div id="keyboard-help-overlay" style="display:none"></div>
        <div id="squad-builder" style="display:none"></div>
      </div>
    `;

    localStorage.clear();
    mockCampaignState = null;
    vi.resetModules();
    const { bootstrap } = await import("@src/renderer/main");
    app = await bootstrap();
    document.dispatchEvent(new Event("DOMContentLoaded"));
  });

  it("should initialize with default theme", async () => {
    const btn = document.getElementById("btn-menu-settings");
    btn?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const themeSelect = document.getElementById(
      "settings-map-theme",
    ) as HTMLSelectElement;
    expect(themeSelect.value).toBe("default");
    expect(document.body.classList.contains("theme-default")).toBe(true);
  });

  it("should apply and persist theme change", async () => {
    const btn = document.getElementById("btn-menu-settings");
    btn?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const themeSelect = document.getElementById(
      "settings-map-theme",
    ) as HTMLSelectElement;

    // Change theme to industrial
    themeSelect.value = "industrial";
    themeSelect.dispatchEvent(new Event("change"));

    expect(document.body.classList.contains("theme-industrial")).toBe(true);
    const globalConfig = ConfigManager.loadGlobal();
    expect(globalConfig.themeId).toBe("industrial");
  });

  it("should load persisted theme on initialization", async () => {
    // 1. Set theme in localStorage
    ConfigManager.saveGlobal({
      ...ConfigManager.loadGlobal(),
      themeId: "hive",
    });

    // 2. Re-initialize app
    vi.resetModules();
    const { bootstrap } = await import("@src/renderer/main");
    app = await bootstrap();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const btn = document.getElementById("btn-menu-settings");
    btn?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const themeSelect = document.getElementById(
      "settings-map-theme",
    ) as HTMLSelectElement;
    expect(themeSelect.value).toBe("hive");
    expect(document.body.classList.contains("theme-hive")).toBe(true);
  });
});
