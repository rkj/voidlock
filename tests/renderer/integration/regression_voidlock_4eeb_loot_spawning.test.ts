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
  stop: vi.fn(),
  getIsPaused: vi.fn().mockReturnValue(false),
  getTargetScale: vi.fn().mockReturnValue(1.0),
  getTimeScale: vi.fn().mockReturnValue(1.0),
  setTimeScale: vi.fn(),
  togglePause: vi.fn(),
  toggleDebugOverlay: vi.fn(),
  toggleLosOverlay: vi.fn(),
  addStateUpdateListener: vi.fn(),
  removeStateUpdateListener: vi.fn(),
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

describe("regression_voidlock_4eeb_loot_spawning", () => {
  let app: GameApp;

  beforeEach(async () => {
    // Reset CampaignManager singleton
    (CampaignManager as any).instance = null;
    CampaignManager.getInstance(new MockStorageProvider());

    // Set up minimal DOM with all required screen containers
    document.body.innerHTML = `
      <div id="screen-main-menu">
        <button id="btn-menu-campaign">Campaign</button>
      </div>
      <div id="screen-campaign-shell">
          <div id="campaign-shell-top-bar"></div>
          <div id="campaign-shell-content">
              <div id="screen-campaign"></div>
              <div id="screen-barracks"></div>
              <div id="screen-equipment"></div>
              <div id="screen-statistics"></div>
              <div id="screen-settings"></div>
              <div id="screen-engineering"></div>
          </div>
      </div>
      <div id="screen-mission-setup">
        <div id="unit-style-preview"></div>
        <div id="mission-setup-context"></div>
        <div id="map-config-section">
            <input id="map-seed" />
            <input id="map-width" />
            <input id="map-height" />
            <input id="map-spawn-points" />
            <span id="map-spawn-points-value"></span>
            <input id="map-base-enemies" />
            <input id="map-enemy-growth" />
            <input id="map-starting-threat" />
        </div>
        <div id="squad-builder"></div>
        <button id="btn-goto-equipment">Equipment</button>
        <button id="btn-launch-mission">Launch Mission</button>
      </div>
      <div id="screen-equipment">
        <button>Confirm Squad</button>
      </div>
      <div id="screen-mission">
        <div id="top-bar"></div>
        <div id="soldier-list"></div>
        <canvas id="game-canvas"></canvas>
        <div id="right-panel"></div>
      </div>
      <div id="screen-debrief"></div>
      <div id="screen-campaign-summary"></div>
    `;

    // Mock ResizeObserver
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    app = new GameApp();
    await app.initialize();
  });

  afterEach(() => {
    app.stop();
  });

  it("should pass bonusLootCount to GameClient.init during campaign mission launch", async () => {
    const cm = CampaignManager.getInstance();
    cm.startNewCampaign(123, "Simulation");
    const state = cm.getState()!;

    // Set bonusLootCount on the accessible node
    const node = state.nodes.find(
      (n) =>
        n.status === "Accessible" &&
        (n.type === "Combat" || n.type === "Elite" || n.type === "Boss"),
    )!;
    node.bonusLootCount = 5;
    cm.save();

    // 1. Enter Campaign
    document.getElementById("btn-menu-campaign")?.click();

    // 2. Select the node
    const nodeEl = document.querySelector(
      ".campaign-node[data-id='" + node.id + "']",
    ) as HTMLElement;
    nodeEl.click();

    // 3. Go to Equipment
    document.getElementById("btn-goto-equipment")?.click();

    // 4. Confirm Squad and launch
    const confirmBtn = Array.from(
      document.querySelectorAll("#screen-equipment button"),
    ).find((btn) => btn.textContent?.includes("Confirm")) as HTMLElement;
    confirmBtn.click();

    // Now in mission-setup, click Launch
    document.getElementById("btn-launch-mission")?.click();

    // 5. Verify GameClient.init was called with bonusLootCount = 5
    // index 25 is the 26th argument: bonusLootCount
    expect(mockGameClient.init).toHaveBeenCalled();
    const lastCall = mockGameClient.init.mock.calls[0];
    expect(lastCall[25]).toBe(5);
  });
});
