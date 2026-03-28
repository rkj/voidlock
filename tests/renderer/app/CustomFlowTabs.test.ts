// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameApp } from "@src/renderer/app/GameApp";
import { t } from "@src/renderer/i18n";
import { I18nKeys } from "@src/renderer/i18n/keys";

// Mock dependencies
vi.mock("@src/engine/GameClient", () => ({
  GameClient: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    start: vi.fn(),
    onObservation: vi.fn(),
    sendCommand: vi.fn(),
    onMessage: vi.fn(),
    freezeForDialog: vi.fn(),
    unfreezeAfterDialog: vi.fn(),
    addStateUpdateListener: vi.fn(),
    removeStateUpdateListener: vi.fn(),
    getIsPaused: vi.fn().mockReturnValue(false),
    getTargetScale: vi.fn().mockReturnValue(1.0),
  })),
}));

vi.mock("@src/renderer/ConfigManager", () => ({
  ConfigManager: {
    loadGlobal: vi.fn().mockReturnValue({
      unitStyle: "TacticalIcons",
      themeId: "default",
      locale: "en-corporate",
    }),
    saveGlobal: vi.fn(),
    loadCampaign: vi.fn().mockReturnValue(null),
    saveCampaign: vi.fn(),
    clearCampaign: vi.fn(),
    getDefault: vi.fn().mockReturnValue({
        fogOfWarEnabled: true,
        debugOverlayEnabled: false, squadConfig: { soldiers: [] } }),
  },
}));

// Mock MetaManager
vi.mock("@src/engine/campaign/MetaManager", () => {
  const mockInstance = {
    getStats: vi.fn().mockReturnValue({
      totalKills: 100,
      totalCampaignsStarted: 5,
      totalMissionsWon: 20,
    }),
    addChangeListener: vi.fn(),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  (mockConstructor as any).getInstance = vi.fn().mockReturnValue(mockInstance);
  return { MetaManager: mockConstructor };
});

describe("Custom Flow Tabs Integration", () => {
  let app: GameApp;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="app">
        <div id="screen-main-menu" class="screen">
          <button id="btn-menu-custom">Custom</button>
          <button id="btn-menu-statistics">Stats</button>
        </div>
        <div id="screen-campaign" class="screen"></div>
        <div id="mission-body"></div>
        <div id="screen-mission" class="screen">
            <canvas id="game-canvas"></canvas>
        </div>
        <div id="screen-statistics" class="screen"></div>
        <div id="screen-campaign-shell"></div>
        <div id="screen-mission-setup" class="screen"></div>
        <div id="screen-equipment" class="screen"></div>
        <div id="screen-debrief" class="screen"></div>
        <div id="screen-campaign-summary" class="screen"></div>
        <div id="screen-engineering" class="screen"></div>
        <div id="screen-settings" class="screen"></div>
      </div>
      <div id="modal-container"></div>
    `;

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

    app = new GameApp();
    await app.initialize();
  });

  it("should keep custom mode (tabs visible) when switching to stats in custom flow", async () => {
    // 1. Enter custom mission setup
    const customBtn = document.getElementById("btn-menu-custom");
    customBtn?.click();

    // 2. Verify CampaignShell is in custom mode
    const shellContainer = document.getElementById("campaign-shell-top-bar");
    expect(shellContainer).not.toBeNull();
    
    let buttons = Array.from(shellContainer!.querySelectorAll("button"));
    let labels = buttons.map((b) => b.textContent);
    expect(labels).toContain(t(I18nKeys.hud.shell.protocol));

    // 3. Switch to Statistics tab (Asset Logs)
    const statsTab = buttons.find(b => b.textContent === t(I18nKeys.hud.shell.asset_logs));
    expect(statsTab).toBeDefined();
    statsTab?.click();

    // 4. Verify statistics screen is shown but tabs still visible
    const statsScreen = document.getElementById("screen-statistics");
    expect(statsScreen?.style.display).toBe("flex");
    
    // Check tabs again
    buttons = Array.from(shellContainer!.querySelectorAll("button"));
    labels = buttons.map((b) => b.textContent);
    expect(labels).toContain(t(I18nKeys.hud.shell.protocol));
  });
});
