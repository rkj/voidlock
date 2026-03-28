// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameApp } from "@src/renderer/app/GameApp";
import { ConfigManager } from "@src/renderer/ConfigManager";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
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
    onStateUpdate: vi.fn(),
    getIsPaused: vi.fn().mockReturnValue(false),
    getTargetScale: vi.fn().mockReturnValue(1.0),
    init: vi.fn().mockResolvedValue(undefined),
  })),
}));

const { mocks } = vi.hoisted(() => ({
  mocks: {
    mockCampaignState: {
      scrap: 500,
      intel: 10,
      currentSector: 1,
      history: [],
      nodes: [
        { id: "n1", type: "Combat", status: "Accessible", missionType: "Default", pos: { x: 0, y: 0 }, connections: [] }
      ],
      currentNodeId: "n1",
      roster: [
        { id: "u1", name: "Alpha", archetypeId: "assault", hp: 100, maxHp: 100, kills: 0, xp: 0, status: "Healthy", equipment: {} }
      ],
      rules: { economyMode: "Open", deathRule: "Reinforced" },
      unlockedArchetypes: ["assault"],
      unlockedItems: [],
    },
    mockGameConfig: {
        mapWidth: 32,
        mapHeight: 24,
        spawnPointCount: 4,
        fogOfWarEnabled: true,
        debugOverlayEnabled: false,
        losOverlayEnabled: false,
        agentControlEnabled: false,
        manualDeployment: false,
        allowTacticalPause: true,
        mapGeneratorType: "DenseShip",
        missionType: "Default",
        lastSeed: 12345,
        squadConfig: { soldiers: [] },
        startingThreatLevel: 0,
        baseEnemyCount: 3,
        enemyGrowthPerMission: 1.0,
    }
  }
}));

vi.mock("@src/renderer/ConfigManager", () => ({
  ConfigManager: {
    loadGlobal: vi.fn().mockReturnValue({
      unitStyle: "TacticalIcons",
      themeId: "default",
      phosphorMode: "green",
      logLevel: "INFO",
      debugSnapshots: false,
      debugSnapshotInterval: 500,
      debugOverlay: false,
      locale: "en-corporate",
    }),
    saveGlobal: vi.fn(),
    loadCampaign: vi.fn().mockReturnValue(mocks.mockGameConfig),
    loadCustom: vi.fn().mockReturnValue(null),
    saveCampaign: vi.fn(),
    clearCampaign: vi.fn(),
    getDefault: vi.fn().mockReturnValue(mocks.mockGameConfig),
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

describe("Regression voidlock-14fv: Campaign Mission Setup Reload", () => {
  let app: GameApp;

  beforeEach(async () => {
    CampaignManager.resetInstance();
    
    document.body.innerHTML = `
      <div id="app">
        <div id="screen-main-menu" class="screen">
          <button id="btn-menu-campaign">Campaign</button>
        </div>
        <div id="screen-campaign" class="screen">
            <div id="campaign-shell-top-bar"></div>
            <div id="campaign-shell-footer"></div>
        </div>
        <div id="screen-mission-setup" class="screen">
            <h1 id="mission-setup-title"></h1>
            <label for="map-generator-type"></label>
            <select id="map-generator-type">
                <option value="DenseShip"></option>
                <option value="TreeShip"></option>
                <option value="Procedural"></option>
                <option value="Static"></option>
            </select>
            <label for="mission-type"></label>
            <select id="mission-type">
                <option value="Default"></option>
                <option value="RecoverIntel"></option>
                <option value="ExtractArtifacts"></option>
                <option value="DestroyHive"></option>
                <option value="EscortVIP"></option>
            </select>
            <div class="control-group">
                <label></label>
                <label><input type="checkbox" id="toggle-fog-of-war"></label>
                <label><input type="checkbox" id="toggle-debug-overlay"></label>
                <label><input type="checkbox" id="toggle-los-overlay"></label>
                <label><input type="checkbox" id="toggle-agent-control"></label>
                <label><input type="checkbox" id="toggle-manual-deployment"></label>
                <label><input type="checkbox" id="toggle-allow-tactical-pause"></label>
            </div>
            <input type="number" id="map-width">
            <input type="number" id="map-height">
            <input type="number" id="map-spawn-points">
            <span id="map-spawn-points-value"></span>
            <input type="range" id="map-starting-threat">
            <span id="map-starting-threat-value"></span>
            <input type="range" id="map-base-enemies">
            <span id="map-base-enemies-value"></span>
            <input type="range" id="map-enemy-growth">
            <span id="map-enemy-growth-value"></span>
            
            <div id="static-map-controls">
                <textarea id="static-map-json"></textarea>
                <button id="load-static-map"></button>
                <input type="file" id="upload-static-map">
            </div>
            <textarea id="ascii-map-input"></textarea>
            <button id="convert-ascii-to-map"></button>
            <input type="file" id="import-replay">

            <button id="btn-goto-equipment"></button>
            <button id="btn-start-mission"></button>
            <button id="btn-setup-back"></button>
        </div>
        <div id="screen-equipment" class="screen"></div>
        <div id="screen-debrief" class="screen">
            <canvas id="debrief-replay-canvas"></canvas>
        </div>
        <div id="screen-campaign-summary" class="screen"></div>
        <div id="screen-statistics" class="screen"></div>
        <div id="screen-engineering" class="screen"></div>
        <div id="screen-settings" class="screen"></div>
        <div id="screen-campaign-shell"></div>
        <div id="screen-mission" class="screen">
            <div id="mission-body"></div>
            <canvas id="game-canvas"></canvas>
            <button id="btn-pause-toggle"></button>
            <button id="btn-give-up"></button>
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

  it("should restore campaign mission setup after reload", async () => {
    // 1. Enter campaign
    const campaignBtn = document.getElementById("btn-menu-campaign");
    campaignBtn?.click();

    // 2. Select node
    const combatNode = mocks.mockCampaignState.nodes.find((n: any) => n.type === "Combat");
    (app as any).registry.navigationOrchestrator.onCampaignNodeSelect(combatNode);

    // 3. Verify Equipment screen
    const equipmentScreen = document.getElementById("screen-equipment");
    expect(equipmentScreen?.style.display).toBe("flex");

    // 4. Simulate reload (re-initialize app)
    app = new GameApp();
    await app.initialize();
    app.start();

    // 5. Verify it went straight back to Equipment screen
    expect(equipmentScreen?.style.display).toBe("flex");
  });
});
