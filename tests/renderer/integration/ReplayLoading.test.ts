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
    init: vi.fn(),
    start: vi.fn(),
    onObservation: vi.fn(),
    sendCommand: vi.fn(),
    onStateUpdate: vi.fn(),
    addStateUpdateListener: vi.fn(),
    removeStateUpdateListener: vi.fn(),
    replay: vi.fn(),
    forceObservation: vi.fn(),
    getMetadata: vi.fn().mockReturnValue({}),
    setMetadata: vi.fn(),
    onMessage: vi.fn(),
    onReplayProgress: vi.fn(),
    freezeForDialog: vi.fn(),
    unfreezeAfterDialog: vi.fn(),
    getReplayData: vi.fn().mockReturnValue({ timeline: [] }),
    loadReplay: vi.fn(),
    stop: vi.fn(),
    setTimeScale: vi.fn(),
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
      logLevel: "INFO",
      debugSnapshotInterval: 100,
      debugOverlayEnabled: false,
      fogOfWarEnabled: true,
    }),
    saveGlobal: vi.fn(),
    loadCampaign: vi.fn().mockReturnValue(null),
    loadCustom: vi.fn().mockReturnValue(null),
    saveCampaign: vi.fn(),
    saveCustom: vi.fn(),
    clearCampaign: vi.fn(),
    getDefault: vi.fn().mockReturnValue({
        fogOfWarEnabled: true,
        debugOverlayEnabled: false, 
        squadConfig: { soldiers: [] },
        mapWidth: 20,
        mapHeight: 20,
        spawnPointCount: 1,
        lastSeed: 1,
        mapGeneratorType: "DenseShip",
        missionType: "Default",
        allowTacticalPause: true,
        manualDeployment: false,
        agentControlEnabled: false,
    }),
  },
}));

// Mock MetaManager
vi.mock("@src/engine/campaign/MetaManager", () => {
  const mockInstance = {
    getStats: vi.fn().mockReturnValue({
      totalKills: 100,
      totalCampaignsStarted: 5,
      campaignsWon: 3,
      campaignsLost: 2,
      totalCasualties: 2,
      totalMissionsPlayed: 10,
      totalMissionsWon: 3,
      totalScrapEarned: 1000,
    }),
    addChangeListener: vi.fn(),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  
  return { MetaManager: mockConstructor };
});

describe("Replay Loading Integration", () => {
  let app: GameApp;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="app">
        <div id="screen-main-menu" class="screen">
          <button id="import-replay">Import</button>
        </div>
        <div id="screen-debrief" class="screen"></div>
        <div id="screen-campaign" class="screen"></div>
        <div id="screen-campaign-shell"></div>
        <div id="screen-equipment" class="screen"></div>
        <div id="screen-mission-setup" class="screen"></div>
        <div id="screen-statistics" class="screen"></div>
        <div id="screen-engineering" class="screen"></div>
        <div id="screen-settings" class="screen"></div>
        <div id="screen-campaign-summary" class="screen"></div>
        <div id="mission-body"></div>
        <div id="screen-mission" class="screen">
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

  it("should load a replay JSON and transition to Debrief Screen", async () => {
    const mockReplay = {
      version: "1.0",
      seed: 123,
      missionType: "Default",
      currentState: {
        seed: 123,
        status: "Won",
        t: 120000,
        units: [{ id: "u1", name: "Alpha", archetypeId: "assault", hp: 100, maxHp: 100, kills: 10, xp: 0, status: "Healthy" }],
        stats: { aliensKilled: 25, casualties: 0, threatLevel: 0, scrapGained: 150 },
      },
      commands: [
        {
          observation: {
            t: 120000,
            status: "Won",
            units: [{ id: "u1", name: "Alpha", archetypeId: "assault", hp: 100, maxHp: 100, kills: 10, xp: 0, status: "Healthy" }],
            enemies: [],
            visibleCells: [],
            stats: { aliensKilled: 25, casualties: 0, threatLevel: 0, scrapGained: 150 },
            map: { width: 10, height: 10, cells: [] },
            objectives: [],
            settings: { allowTacticalPause: true, debugOverlayEnabled: false, isPaused: false, targetTimeScale: 1.0, timeScale: 1.0 },
          },
        },
      ],
    };

    // Simulate file import
    const json = JSON.stringify(mockReplay);
    await (app as any).handleReplayImport(json);

    // Verify screen transition
    const debriefScreen = document.getElementById("screen-debrief");
    expect(debriefScreen?.style.display).toBe("flex");

    // Verify Mission Stats on screen
    expect(debriefScreen?.innerHTML).toContain(t(I18nKeys.screen.debrief.header_success));
    expect(debriefScreen?.innerHTML).toContain("25"); // Aliens killed
    expect(debriefScreen?.innerHTML).toContain("150"); // Scrap
  });

  it("should load a replay-only JSON (no currentState) and still transition to Debrief Screen", async () => {
    const mockReplayOnly = {
      version: "1.0",
      seed: 456,
      commands: [],
      squadConfig: {
        soldiers: [{ id: "u1", name: "Sarge", archetypeId: "assault" }],
        inventory: {}
      }
    };

    const json = JSON.stringify(mockReplayOnly);
    await (app as any).handleReplayImport(json);

    const debriefScreen = document.getElementById("screen-debrief");
    expect(debriefScreen?.style.display).toBe("flex");

    // Verify Mission Success (default)
    expect(debriefScreen?.innerHTML).toContain(t(I18nKeys.screen.debrief.header_success));
    expect(debriefScreen?.innerHTML).toContain("Sarge");
  });
});
