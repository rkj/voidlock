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

const mockModalService = {
  alert: vi.fn().mockResolvedValue(undefined),
  confirm: vi.fn().mockResolvedValue(true),
  show: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@src/renderer/ui/ModalService", () => ({
  ModalService: vi.fn().mockImplementation(() => mockModalService),
}));

// Mock CampaignManager
let mockCampaignState: any = null;

vi.mock("@src/renderer/campaign/CampaignManager", () => {
  const mockInstance = {
    getState: vi.fn(() => mockCampaignState),
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
    reconcileMission: vi.fn((report) => {
        if (mockCampaignState) {
            const node = mockCampaignState.nodes.find((n: any) => n.id === report.nodeId);
            if (node) node.status = "Cleared";
            mockCampaignState.history.push(report);
        }
    }),
    processMissionResult: vi.fn((report) => {
        if (mockCampaignState) {
            const node = mockCampaignState.nodes.find((n: any) => n.id === report.nodeId);
            if (node) node.status = "Cleared";
            mockCampaignState.history.push(report);
        }
    }),
    startNewCampaign: vi.fn(),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  (mockConstructor as any).getInstance = vi.fn().mockReturnValue(mockInstance);
  return {
    CampaignManager: mockConstructor,
  };
});

describe("Abort Persistence Regression", () => {
  let app: GameApp;

  beforeEach(async () => {
    mockCampaignState = {
      status: "Active",
      nodes: [
          { id: "node-1", type: "Combat", status: "Accessible", rank: 0, difficulty: 1, mapSeed: 1, connections: [], position: {x:0, y:0}, bonusLootCount: 0 }
      ],
      roster: [
          { id: "s1", name: "S1", archetypeId: "scout", status: "Healthy", level: 1, hp: 100, maxHp: 100, xp: 0, kills: 0, missions: 0, recoveryTime: 0, soldierAim: 80, equipment: { rightHand: "pistol", leftHand: undefined, body: undefined, feet: undefined } }
      ],
      scrap: 100,
      intel: 0,
      currentSector: 1,
      currentNodeId: null,
      history: [],
      rules: {
        mode: "Preset",
        difficulty: "Standard",
        allowTacticalPause: true,
        mapGeneratorType: "DenseShip",
      },
    };

    document.body.innerHTML = `
      <div id="app">
        <div id="screen-main-menu" class="screen">
          <button id="btn-menu-campaign">Campaign</button>
        </div>
        <div id="screen-campaign-shell" style="display:none">
            <div id="campaign-shell-content">
                <div id="screen-campaign" class="screen" style="display:none"></div>
                <div id="screen-equipment" style="display:none"></div>
                <div id="screen-statistics" style="display:none"></div>
                <div id="screen-engineering" style="display:none"></div>
                <div id="screen-settings" style="display:none"></div>
            </div>
            <div id="campaign-shell-top-bar"></div>
            <div id="campaign-shell-footer"></div>
        </div>
        <div id="screen-mission-setup" style="display:none">
            <button id="btn-launch-mission">Launch</button>
        </div>
        <div id="screen-mission" style="display:none">
            <button id="btn-give-up">Abort</button>
        </div>
        <div id="screen-debrief" style="display:none"></div>
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

  it("should clear mission state and update campaign when mission is aborted", async () => {
    // 1. Start mission
    document.getElementById("btn-menu-campaign")?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const nodeEl = document.querySelector(".campaign-node") as HTMLElement;
    nodeEl?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    document.getElementById("btn-launch-mission")?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 2. Set some tactical state
    localStorage.setItem("voidlock_mission_tick", "1000");

    // 3. Abort Mission
    mockModalService.confirm.mockResolvedValue(true);
    document.getElementById("btn-give-up")?.click();

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify we are on Debrief screen
    expect(document.getElementById("screen-debrief")?.style.display).toBe("flex");

    // Verify mission status in campaign state
    expect(mockCampaignState.history.length).toBe(1);
    expect(mockCampaignState.history[0].result).toBe("Lost");

    // Verify tactical session state is cleared
    expect(localStorage.getItem("voidlock_mission_tick")).toBeNull();
  });
});
