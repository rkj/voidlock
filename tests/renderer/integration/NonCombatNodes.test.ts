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

let mockOnChoice: (choice: any) => void;
vi.mock("@src/renderer/ui/EventModal", () => ({
  EventModal: vi.fn().mockImplementation((onChoice) => {
    mockOnChoice = onChoice;
    return {
      show: vi.fn(),
      hide: vi.fn(),
    };
  }),
  OutcomeModal: vi.fn().mockImplementation((onConfirm) => ({
    show: vi.fn().mockImplementation(() => onConfirm()),
    hide: vi.fn(),
  }))
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
      <div id="screen-debrief" class="screen" style="display:none"></div>
      <div id="screen-campaign-summary" class="screen" style="display:none"></div>
      <div id="screen-statistics" class="screen" style="display:none"></div>
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

  it("should handle Event nodes correctly", async () => {
    manager.startNewCampaign(12345, "normal");
    const state = manager.getState()!;
    
    // Seed 456 with derelict_ship (first event in CampaignEvents)
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
    const applyChoiceSpy = vi.spyOn(manager, "applyEventChoice");

    (app as any).onCampaignNodeSelected(eventNode);

    // Verify EventModal was shown
    const { EventModal } = await import("@src/renderer/ui/EventModal");
    expect(EventModal).toHaveBeenCalled();

    // Trigger a choice (e.g., the first one: Search)
    const choice = { label: "Search", reward: { scrap: 50 } };
    mockOnChoice(choice);

    expect(applyChoiceSpy).toHaveBeenCalled();
    expect(eventNode.status).toBe("Cleared");
  });
});
