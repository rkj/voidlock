/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CampaignManager } from "@src/engine/managers/CampaignManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
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
  setTimeScale: vi.fn(),
  togglePause: vi.fn(),
  toggleDebugOverlay: vi.fn(),
  toggleLosOverlay: vi.fn(),
  getReplayData: vi.fn().mockReturnValue({ seed: 123, commandLog: [] }),
  forceWin: vi.fn(),
  forceLose: vi.fn(),
  loadReplay: vi.fn(),
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

const mockModalService = {
  alert: vi.fn().mockResolvedValue(undefined),
  confirm: vi.fn().mockResolvedValue(true),
  show: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@src/renderer/ui/ModalService", () => ({
  ModalService: vi.fn().mockImplementation(() => mockModalService),
}));

describe("regression_voidlock_4eeb_loot_spawning", () => {
  let storage: MockStorageProvider;
  let app: GameApp;

  beforeEach(async () => {
    storage = new MockStorageProvider();
    CampaignManager.resetInstance();
    CampaignManager.getInstance(storage);

    // Mock ResizeObserver
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    // Mock getContext for canvas
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn(),
    }) as any;

    // Set up minimal DOM
    document.body.innerHTML = `
      <div id="screen-main-menu">
        <button id="btn-menu-campaign">Campaign</button>
      </div>
      <div id="screen-campaign-shell">
          <div id="screen-campaign"></div>
          <div id="screen-barracks"></div>
          <div id="screen-equipment"></div>
          <div id="screen-statistics"></div>
          <div id="screen-settings"></div>
          <div id="campaign-shell-top-bar"></div>
      </div>
      <div id="screen-mission-setup">
        <div id="unit-style-preview"></div>
        <input id="map-seed" />
        <input id="map-width" />
        <input id="map-height" />
        <input id="map-spawn-points" />
        <span id="map-spawn-points-value"></span>
        <input id="map-base-enemies" />
        <input id="map-enemy-growth" />
        <input id="map-starting-threat" />
        <div id="squad-builder"></div>
        <button id="btn-goto-equipment">Equipment</button>
      </div>
      <div id="screen-equipment">
        <button>Confirm</button>
      </div>
      <div id="screen-mission">
        <canvas id="game-canvas"></canvas>
      </div>
      <div id="screen-debrief"></div>
      <div id="screen-campaign-summary"></div>
    `;

    app = new GameApp();
    await app.initialize();
  });

  afterEach(() => {
    app.stop();
  });

  it("should pass bonusLootCount to GameClient.init during campaign mission launch", async () => {
    // 1. Start a campaign
    const cm = CampaignManager.getInstance();
    cm.startNewCampaign(123, "Simulation");
    const state = cm.getState()!;

    // Force bonusLootCount on the first node
    const accessibleNode = state.nodes.find((n) => n.status === "Accessible")!;
    accessibleNode.bonusLootCount = 3;
    cm.save();

    // 2. Launch mission
    app.start();
    document.getElementById("btn-menu-campaign")?.click();

    // Select the node
    const nodeEl = document.querySelector(
      `.campaign-node[data-id="${accessibleNode.id}"]`,
    ) as HTMLElement;
    nodeEl?.click();

    // Wait for mission-setup screen
    await new Promise((resolve) => {
      const check = () => {
        if (
          document.getElementById("screen-mission-setup")?.style.display !==
          "none"
        ) {
          resolve(true);
        } else {
          setTimeout(check, 10);
        }
      };
      check();
    });

    // Click Equipment button in mission-setup
    document.getElementById("btn-goto-equipment")?.click();

    // Wait for equipment screen
    await new Promise((resolve) => {
      const check = () => {
        if (
          document.getElementById("screen-equipment")?.style.display !== "none"
        ) {
          resolve(true);
        } else {
          setTimeout(check, 10);
        }
      };
      check();
    });

    // Confirm equipment to launch
    const confirmBtn = Array.from(
      document.querySelectorAll("#screen-equipment button"),
    ).find((b) => b.textContent?.includes("Confirm")) as HTMLElement;
    confirmBtn?.click();

    // 3. Verify GameClient.init was called with bonusLootCount = 3
    expect(mockGameClient.init).toHaveBeenCalled();
    const lastCall = mockGameClient.init.mock.calls[0];

    // bonusLootCount is the 25th argument (index 24)
    expect(lastCall[24]).toBe(3);
  });
});
