import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
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

let mockOnChoice: (choice: any) => void;
vi.mock("@src/renderer/ui/EventModal", () => ({
  EventModal: vi.fn().mockImplementation((modalService, onChoice) => {
    mockOnChoice = onChoice;
    return {
      show: vi.fn(),
    };
  }),
  OutcomeModal: vi.fn().mockImplementation((modalService, onConfirm) => ({
    show: vi.fn(),
  })),
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
    reconcileMission: vi.fn(),
    advanceCampaignWithoutMission: vi.fn((nodeId, scrap, intel) => {
        if (mockCampaignState) {
            const node = mockCampaignState.nodes.find((n: any) => n.id === nodeId);
            if (node) node.status = "Cleared";
            mockCampaignState.scrap += scrap || 0;
            mockCampaignState.intel += intel || 0;
        }
    }),
    applyEventChoice: vi.fn((nodeId, choice, prng) => {
        if (mockCampaignState) {
            mockCampaignState.scrap += choice.reward?.scrap || 0;
        }
        return { text: "Outcome", ambush: false };
    }),
    startNewCampaign: vi.fn(),
    generateEvent: vi.fn().mockReturnValue({
        title: "Test Event",
        text: "Something happened",
        choices: [{ label: "Search", reward: { scrap: 50 } }]
    }),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  (mockConstructor as any).getInstance = vi.fn().mockReturnValue(mockInstance);
  return {
    CampaignManager: mockConstructor,
  };
});

describe("Non-Combat Nodes Integration", () => {
  let app: GameApp;

  beforeEach(async () => {
    mockCampaignState = {
      status: "Active",
      nodes: [],
      roster: [],
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
        <div id="screen-mission-setup" style="display:none"></div>
        <div id="screen-mission" style="display:none"></div>
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

  it("should handle Shop nodes by showing Equipment screen", async () => {
    const shopNode = {
      id: "node-shop",
      type: "Shop",
      status: "Accessible",
      difficulty: 1,
      rank: 0,
      mapSeed: 123,
      connections: ["node-next"],
      position: { x: 0, y: 0 },
      bonusLootCount: 0,
    };
    mockCampaignState.nodes = [shopNode];

    // Click campaign
    document.getElementById("btn-menu-campaign")?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Simulate node select
    const orchestrator = (app as any).registry.navigationOrchestrator;
    orchestrator.onCampaignNodeSelect(shopNode);

    // Should be on equipment screen (Shop)
    expect(document.getElementById("screen-equipment")?.style.display).toBe("flex");
  });

  it("should handle Event nodes by showing EventModal", async () => {
    const eventNode = {
      id: "node-event",
      type: "Event",
      status: "Accessible",
      difficulty: 1,
      rank: 0,
      mapSeed: 456,
      connections: ["node-next"],
      position: { x: 100, y: 100 },
      bonusLootCount: 0,
    };
    mockCampaignState.nodes = [eventNode];

    const { CampaignManager } = await import("@src/renderer/campaign/CampaignManager");
    const manager = CampaignManager.getInstance();

    // Simulate node select
    const orchestrator = (app as any).registry.navigationOrchestrator;
    orchestrator.onCampaignNodeSelect(eventNode);

    // Verify EventModal was shown
    const { EventModal } = await import("@src/renderer/ui/EventModal");
    expect(EventModal).toHaveBeenCalled();

    // Trigger a choice
    const choice = { label: "Search", reward: { scrap: 50 } };
    mockOnChoice(choice);

    expect(manager.applyEventChoice).toHaveBeenCalledWith(eventNode.id, choice, expect.anything());
  });
});
