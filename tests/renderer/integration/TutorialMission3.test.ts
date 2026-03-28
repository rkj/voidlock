// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameApp } from "@src/renderer/app/GameApp";
import { ConfigManager } from "@src/renderer/ConfigManager";
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

const { mocks } = vi.hoisted(() => ({
  mocks: {
    mockCampaignState: {
      scrap: 500,
      intel: 10,
      currentSector: 1,
      history: [{}, {}], // Two missions completed
      nodes: [
        { id: "n1", type: "Combat", status: "Accessible", missionType: "Default", pos: { x: 0, y: 0 }, connections: [] }
      ],
      currentNodeId: "n1",
      roster: [],
      rules: { economyMode: "Open", deathRule: "Reinforced" },
      unlockedArchetypes: [],
      unlockedItems: [],
    }
  }
}));

vi.mock("@src/renderer/ConfigManager", () => ({
  ConfigManager: {
    loadGlobal: vi.fn().mockReturnValue({
      unitStyle: "TacticalIcons",
      themeId: "default",
      locale: "en-corporate",
    }),
    saveGlobal: vi.fn(),
    loadCampaign: vi.fn().mockReturnValue(mocks.mockCampaignState),
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
      totalCampaignsStarted: 1,
      totalMissionsWon: 2,
    }),
    addChangeListener: vi.fn(),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  (mockConstructor as any).getInstance = vi.fn().mockReturnValue(mockInstance);
  return { MetaManager: mockConstructor };
});

describe("Tutorial Mission 3 Integration", () => {
  let app: GameApp;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="app">
        <div id="screen-main-menu" class="screen">
          <button id="btn-menu-campaign">Campaign</button>
        </div>
        <div id="screen-campaign" class="screen">
            <div id="campaign-shell-top-bar"></div>
            <div id="campaign-shell-footer"></div>
        </div>
        <div id="screen-equipment" class="screen"></div>
        <div id="screen-debrief" class="screen">
            <canvas id="debrief-replay-canvas"></canvas>
        </div>
        <div id="screen-campaign-shell"></div>
        <div id="screen-mission" class="screen">
            <div id="mission-body"></div>
            <canvas id="game-canvas"></canvas>
        </div>
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

  it("should unlock Sector Map and all tabs in Mission 3", async () => {
    // 1. Enter campaign (Mission 3 state)
    const campaignBtn = document.getElementById("btn-menu-campaign");
    campaignBtn?.click();

    // 2. Verify all tabs are shown
    const tabs = Array.from(document.querySelectorAll(".shell-tab"));
    
    const tabLabels = tabs.map(t => t.textContent);
    expect(tabLabels).toContain(t(I18nKeys.hud.shell.operational_map));
    expect(tabLabels).toContain(t(I18nKeys.hud.shell.asset_management_hub));
    expect(tabLabels).toContain(t(I18nKeys.hud.shell.system_engineering));
  });
});
