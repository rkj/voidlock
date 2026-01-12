/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { GameApp } from "@src/renderer/app/GameApp";

// Mock dependencies
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" }
}));

const mockGameClient = {
  init: vi.fn(),
  onStateUpdate: vi.fn(),
  stop: vi.fn(),
  getIsPaused: vi.fn().mockReturnValue(false),
  getTargetScale: vi.fn().mockReturnValue(1.0),
  togglePause: vi.fn(),
  toggleDebugOverlay: vi.fn(),
  toggleLosOverlay: vi.fn(),
};

vi.mock("@src/engine/GameClient", () => ({
  GameClient: vi.fn().mockImplementation(() => mockGameClient),
}));

vi.mock("@src/renderer/Renderer", () => ({
  Renderer: vi.fn().mockImplementation(() => ({
    render: vi.fn(),
    setCellSize: vi.fn(),
    setUnitStyle: vi.fn(),
    setOverlay: vi.fn(),
    getCellCoordinates: vi.fn().mockReturnValue({ x: 0, y: 0 }),
  })),
}));

vi.mock("@src/renderer/ThemeManager", () => ({
  ThemeManager: {
    getInstance: vi.fn().mockReturnValue({
      init: vi.fn().mockResolvedValue(undefined),
      setTheme: vi.fn(),
    }),
  },
}));

describe("Non-Combat Node Interactions", () => {
  let app: GameApp;
  let manager: CampaignManager;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Mock ResizeObserver
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    // Mock window.confirm/alert
    window.confirm = vi.fn().mockReturnValue(true);
    window.alert = vi.fn();

    // Setup DOM
    document.body.innerHTML = `
      <div id="screen-main-menu"></div>
      <div id="screen-campaign"></div>
      <div id="screen-barracks"></div>
      <div id="screen-mission-setup"></div>
      <div id="screen-equipment"></div>
      <div id="screen-mission"></div>
      <div id="screen-debrief"></div>
      <canvas id="game-canvas"></canvas>
    `;

    CampaignManager.resetInstance();
    manager = CampaignManager.getInstance(new (class {
      save() {}
      load() { return null; }
      remove() {}
      clear() {}
    })());

    app = new GameApp();
    await app.initialize();
  });

  it("should handle Shop nodes by granting scrap and advancing rank", async () => {
    // 1. Start a campaign
    manager.startNewCampaign(12345, "normal");
    const state = manager.getState()!;
    
    // 2. Find a Shop node (or force one for testing)
    const shopNode = {
      id: "node-shop",
      type: "Shop" as any,
      status: "Accessible" as any,
      difficulty: 1,
      rank: 0,
      mapSeed: 456,
      connections: ["node-next"],
      position: { x: 100, y: 100 },
      bonusLootCount: 0
    };
    const nextNode = {
      id: "node-next",
      type: "Combat" as any,
      status: "Revealed" as any,
      difficulty: 2,
      rank: 1,
      mapSeed: 789,
      connections: [],
      position: { x: 200, y: 100 },
      bonusLootCount: 0
    };
    state.nodes = [shopNode, nextNode];

    const initialScrap = state.scrap;
    const advanceSpy = vi.spyOn(manager, "advanceCampaignWithoutMission");

    // 3. Simulate clicking the shop node
    // In GameApp, onCampaignNodeSelected is called by CampaignScreen
    // We can call it directly for the test
    (app as any).onCampaignNodeSelected(shopNode);

    // 4. Verify results
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("Supply Depot reached"));
    expect(advanceSpy).toHaveBeenCalledWith("node-shop", 100, 0);
    expect(state.scrap).toBe(initialScrap + 100);
    expect(shopNode.status).toBe("Cleared");
    expect(nextNode.status).toBe("Accessible");
  });

  it("should handle Event nodes with a successful search", async () => {
    manager.startNewCampaign(12345, "normal");
    const state = manager.getState()!;
    
    const eventNode = {
      id: "node-event",
      type: "Event" as any,
      status: "Accessible" as any,
      difficulty: 1,
      rank: 0,
      mapSeed: 456,
      connections: ["node-next"],
      position: { x: 100, y: 100 },
      bonusLootCount: 0
    };
    const nextNode = {
      id: "node-next",
      type: "Combat" as any,
      status: "Revealed" as any,
      difficulty: 2,
      rank: 1,
      mapSeed: 789,
      connections: [],
      position: { x: 200, y: 100 },
      bonusLootCount: 0
    };
    state.nodes = [eventNode, nextNode];

    const initialScrap = state.scrap;
    const advanceSpy = vi.spyOn(manager, "advanceCampaignWithoutMission");

    // Force Math.random to return > 0.5 for success
    vi.spyOn(Math, "random").mockReturnValue(0.6);
    // Force confirm to true
    (window.confirm as any).mockReturnValue(true);

    (app as any).onCampaignNodeSelected(eventNode);

    expect(window.confirm).toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("SEARCH SUCCESSFUL"));
    expect(advanceSpy).toHaveBeenCalledWith("node-event", 50, 0);
    expect(state.scrap).toBe(initialScrap + 50);
    expect(eventNode.status).toBe("Cleared");
  });

  it("should handle Event nodes with a failed search", async () => {
    manager.startNewCampaign(12345, "normal");
    const state = manager.getState()!;
    
    const eventNode = {
      id: "node-event",
      type: "Event" as any,
      status: "Accessible" as any,
      difficulty: 1,
      rank: 0,
      mapSeed: 456,
      connections: ["node-next"],
      position: { x: 100, y: 100 },
      bonusLootCount: 0
    };
    state.nodes = [eventNode];

    const initialScrap = state.scrap;
    const advanceSpy = vi.spyOn(manager, "advanceCampaignWithoutMission");

    // Force Math.random to return < 0.5 for failure
    vi.spyOn(Math, "random").mockReturnValue(0.4);
    (window.confirm as any).mockReturnValue(true);

    (app as any).onCampaignNodeSelected(eventNode);

    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("SEARCH FAILED"));
    expect(advanceSpy).toHaveBeenCalledWith("node-event", 0, 0);
    expect(state.scrap).toBe(initialScrap);
    expect(eventNode.status).toBe("Cleared");
  });

  it("should handle Event nodes when ignored", async () => {
    manager.startNewCampaign(12345, "normal");
    const state = manager.getState()!;
    
    const eventNode = {
      id: "node-event",
      type: "Event" as any,
      status: "Accessible" as any,
      difficulty: 1,
      rank: 0,
      mapSeed: 456,
      connections: ["node-next"],
      position: { x: 100, y: 100 },
      bonusLootCount: 0
    };
    state.nodes = [eventNode];

    const advanceSpy = vi.spyOn(manager, "advanceCampaignWithoutMission");

    // Force confirm to false
    (window.confirm as any).mockReturnValue(false);

    (app as any).onCampaignNodeSelected(eventNode);

    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("Signal ignored"));
    expect(advanceSpy).toHaveBeenCalledWith("node-event", 0, 0);
    expect(eventNode.status).toBe("Cleared");
  });
});
