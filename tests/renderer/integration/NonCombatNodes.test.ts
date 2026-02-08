/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { GameApp } from "@src/renderer/app/GameApp";

// Mock dependencies
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

const mockGameClient = {
  init: vi.fn(),
  onStateUpdate: vi.fn(),
  addStateUpdateListener: vi.fn(),
  removeStateUpdateListener: vi.fn(),
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
      getAssetUrl: vi.fn().mockReturnValue("mock-url"),
      getColor: vi.fn().mockReturnValue("#000"),
      getIconUrl: vi.fn().mockReturnValue("mock-icon-url"),
      getCurrentThemeId: vi.fn().mockReturnValue("default"),
      applyTheme: vi.fn(),
    }),
  },
}));

const mockModalService = {
  alert: vi.fn().mockResolvedValue(undefined),
  confirm: vi.fn().mockResolvedValue(true),
  prompt: vi.fn().mockResolvedValue("New Recruit"),
  show: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@src/renderer/ui/ModalService", () => ({
  ModalService: vi.fn().mockImplementation(() => mockModalService),
}));

let mockOnChoice: (choice: any) => void;
vi.mock("@src/renderer/ui/EventModal", () => ({
  EventModal: vi.fn().mockImplementation((_modalService, onChoice) => {
    mockOnChoice = onChoice;
    return {
      show: vi.fn(),
      hide: vi.fn(),
    };
  }),
  OutcomeModal: vi.fn().mockImplementation((_modalService, onConfirm) => ({
    show: vi.fn().mockImplementation(() => onConfirm()),
    hide: vi.fn(),
  })),
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
      <div id="screen-main-menu" class="screen">
        <button id="btn-menu-campaign">Campaign</button>
        <button id="btn-menu-custom">Custom Mission</button>
        <p id="menu-version"></p>
      </div>

      <div id="screen-campaign-shell" class="screen flex-col" style="display:none">
          <div id="campaign-shell-top-bar"></div>
          <div id="campaign-shell-content" class="flex-grow relative overflow-hidden">
              <div id="screen-campaign" class="screen" style="display:none"></div>
              <div id="screen-barracks" class="screen" style="display:none"></div>
              <div id="screen-equipment" class="screen" style="display:none"></div>
              <div id="screen-statistics" class="screen" style="display:none"></div>
              <div id="screen-settings" class="screen" style="display:none"></div>
              <div id="screen-engineering" class="screen" style="display:none"></div>
          </div>
      </div>
      <div id="screen-mission-setup" class="screen" style="display:none">
        <div id="mission-setup-context"></div>
        <div id="unit-style-preview"></div>
        <div id="squad-builder"></div>
        <select id="mission-type"></select>
        <select id="map-generator-type"></select>
        <input id="map-seed" />
        <input id="map-width" />
        <input id="map-height" />
        <input id="map-spawn-points" />
        <span id="map-spawn-points-value"></span>
        <input id="map-starting-threat" />
        <span id="map-starting-threat-value"></span>
        <input id="map-base-enemies" />
        <span id="map-base-enemies-value"></span>
        <input id="map-enemy-growth" />
        <span id="map-enemy-growth-value"></span>
        <input id="toggle-fog-of-war" type="checkbox" />
        <input id="toggle-debug-overlay" type="checkbox" />
        <input id="toggle-los-overlay" type="checkbox" />
        <input id="toggle-agent-control" type="checkbox" />
        <input id="toggle-allow-tactical-pause" type="checkbox" />
        <select id="select-unit-style"></select>
        <button id="btn-goto-equipment"></button>
        <button id="btn-setup-back"></button>
      </div>
      <div id="screen-mission" class="screen" style="display:none">
        <button id="btn-pause-toggle"></button>
        <input id="game-speed" type="range" />
        <span id="speed-value"></span>
        <input id="time-scale-slider" type="range" />
        <span id="time-scale-value"></span>
        <button id="btn-give-up"></button>
        <div id="top-threat-fill"></div>
        <span id="top-threat-value"></span>
        <div id="game-canvas-container">
            <canvas id="game-canvas"></canvas>
        </div>
      </div>
      <div id="screen-debrief" class="screen" style="display:none"></div>
      <div id="screen-campaign-summary" class="screen" style="display:none"></div>
    `;

    CampaignManager.resetInstance();
    manager = CampaignManager.getInstance(
      new (class {
        save() {}
        load() {
          return null;
        }
        remove() {}
        clear() {}
      })(),
    );

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
      bonusLootCount: 0,
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
      bonusLootCount: 0,
    };
    state.nodes = [shopNode, nextNode];

    const initialScrap = state.scrap;
    const advanceSpy = vi.spyOn(manager, "advanceCampaignWithoutMission");

    // 3. Simulate clicking the shop node
    // In GameApp, onCampaignNodeSelected is now handled by campaignFlowCoordinator
    await (app as any).campaignFlowCoordinator.onCampaignNodeSelected(
      shopNode,
      () => {},
      () => {},
    );

    // 4. Verify results
    expect(mockModalService.alert).toHaveBeenCalledWith(
      expect.stringContaining("Supply Depot reached"),
    );
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
      bonusLootCount: 0,
    };
    state.nodes = [eventNode];

    const applyChoiceSpy = vi.spyOn(manager, "applyEventChoice");

    await (app as any).campaignFlowCoordinator.onCampaignNodeSelected(
      eventNode,
      () => {},
      () => {},
    );

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
