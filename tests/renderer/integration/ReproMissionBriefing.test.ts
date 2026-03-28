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
      history: [],
      nodes: [
        { id: "n1", type: "Combat", status: "Accessible", missionType: "Default", pos: { x: 0, y: 0 }, connections: [] }
      ],
      currentNodeId: null,
      roster: [
        { id: "u1", name: "Alpha", archetypeId: "assault", hp: 100, maxHp: 100, kills: 0, xp: 0, status: "Healthy", equipment: {} }
      ],
      rules: { economyMode: "Open", deathRule: "Reinforced" },
      unlockedArchetypes: ["assault"],
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
      totalCampaignsStarted: 5,
      totalMissionsWon: 20,
    }),
    addChangeListener: vi.fn(),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  (mockConstructor as any).getInstance = vi.fn().mockReturnValue(mockInstance);
  return { MetaManager: mockConstructor };
});

describe("Repro: Mission Briefing Screen Leak", () => {
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
        <div id="screen-mission-setup" class="screen"></div>
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

  it("should NEVER show Mission Setup screen when clicking a node in campaign mode", async () => {
    // 1. Enter campaign
    const campaignBtn = document.getElementById("btn-menu-campaign");
    campaignBtn?.click();

    // 2. Click a combat node
    const combatNode = mocks.mockCampaignState.nodes.find((n: any) => n.type === "Combat");
    const nodeEl = document.querySelector(
      `.campaign-node[data-id="${combatNode.id}"]`,
    ) as HTMLElement;
    expect(nodeEl).toBeTruthy();
    nodeEl.click();

    // 3. Verify we went to Equipment screen, NOT Mission Setup
    const equipmentScreen = document.getElementById("screen-equipment");
    const setupScreen = document.getElementById("screen-mission-setup");

    expect(equipmentScreen?.style.display).toBe("flex");
    expect(setupScreen?.style.display).toBe("none");
  });
});
