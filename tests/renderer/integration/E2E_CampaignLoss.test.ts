/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CampaignManager } from "@src/engine/managers/CampaignManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { GameStatus, UnitState } from "@src/shared/types";

import { GameApp } from "@src/renderer/app/GameApp";

// Mock dependencies
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

// Trigger for GameClient callbacks
let stateUpdateCallback: ((state: any) => void) | null = null;

const mockGameClient = {
  init: vi.fn(),
  onStateUpdate: vi.fn((cb) => {
    stateUpdateCallback = cb;
  }),
  stop: vi.fn(),
  getIsPaused: vi.fn().mockReturnValue(false),
  getTargetScale: vi.fn().mockReturnValue(1.0),
  setTimeScale: vi.fn(),
  togglePause: vi.fn(),
  toggleDebugOverlay: vi.fn(),
  toggleLosOverlay: vi.fn(),
  getReplayData: vi.fn().mockReturnValue({ seed: 123, commands: [] }),
  forceWin: vi.fn(),
  forceLose: vi.fn(),
  loadReplay: vi.fn(),
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

describe("E2E Campaign Failure Modes", () => {
  let app: GameApp;
  let cm: CampaignManager;

  beforeEach(async () => {
    // Reset singleton with storage
    (CampaignManager as any).instance = null;
    cm = CampaignManager.getInstance(new MockStorageProvider());

    // Set up minimal DOM
    document.body.innerHTML = `
      <div id="screen-main-menu" class="screen">
        <button id="btn-menu-campaign">Campaign</button>
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
        <div id="unit-style-preview"></div>
        <div id="map-config-section">
          <input type="number" id="map-seed" />
          <input type="number" id="map-width" value="10" />
          <input type="number" id="map-height" value="10" />
          <input type="number" id="map-spawn-points" value="1" />
          <input type="range" id="map-starting-threat" value="0" />
          <span id="map-starting-threat-value">0</span>
        </div>
        <div id="squad-builder"></div>
        <button id="btn-goto-equipment">Equipment</button>
        <button id="btn-setup-back">Back</button>
      </div>

      <div id="screen-mission" class="screen" style="display:none">
        <div id="top-bar">
          <div id="game-status"></div>
          <div id="top-threat-fill"></div>
          <div id="top-threat-value">0%</div>
          <button id="btn-pause-toggle">Pause</button>
          <input type="range" id="game-speed" />
          <button id="btn-give-up">Give Up</button>
        </div>
        <div id="soldier-list"></div>
        <canvas id="game-canvas"></canvas>
        <div id="right-panel"></div>
      </div>

      <div id="screen-debrief" class="screen" style="display:none">
          <button id="btn-debrief-continue">Continue</button>
      </div>

      <div id="screen-campaign-summary" class="screen" style="display:none"></div>
    `;

    // Mock ResizeObserver
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    app = new GameApp();
    await app.initialize();
    app.start();
  });

  afterEach(() => {
    if (app) app.stop();
  });

  it("Ironman: Start Ironman -> Force Lose -> Verify Defeat", async () => {
    // 1. Start Ironman
    document.getElementById("btn-menu-campaign")?.click();

    const ironmanCard = Array.from(
      document.querySelectorAll(".difficulty-card"),
    ).find((c) => c.textContent?.includes("Ironman")) as HTMLElement;
    expect(ironmanCard).toBeTruthy();
    ironmanCard?.click();

    const startBtn = document.querySelector(
      ".campaign-setup-wizard .primary-button",
    ) as HTMLElement;
    expect(startBtn).toBeTruthy();
    startBtn.click();

    // 2. Mission Setup
    const state = cm.getState()!;
    const node = state.nodes.find(
      (n) =>
        n.status === "Accessible" &&
        (n.type === "Combat" || n.type === "Elite" || n.type === "Boss"),
    )!;
    const nodeEl = document.querySelector(
      `.campaign-node[data-id="${node.id}"]`,
    ) as HTMLElement;
    nodeEl.click();

    // Wait for async onCampaignNodeSelected
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.getElementById("screen-equipment")?.style.display).toBe(
      "flex",
    );

    const confBtn = Array.from(
      document.querySelectorAll("#screen-equipment button"),
    ).find((b) => b.textContent?.includes("Confirm")) as HTMLElement;
    confBtn?.click();

    expect(document.getElementById("screen-mission")?.style.display).toBe(
      "flex",
    );

    // 3. Force Lose
    stateUpdateCallback!({
      status: "Lost",
      t: 10,
      stats: { aliensKilled: 0, scrapGained: 0, threatLevel: 100 },
      units: [],
      objectives: [],
      settings: {
        debugOverlayEnabled: false,
        debugSnapshots: false,
        timeScale: 1.0,
        isPaused: false,
      },
      map: { width: 10, height: 10, cells: [] },
      enemies: [],
      visibleCells: [],
      discoveredCells: [],
      loot: [],
    });

    expect(cm.getState()?.status).toBe("Defeat");

    const returnBtn = Array.from(
      document.querySelectorAll("#screen-debrief button"),
    ).find((b) => b.textContent?.includes("Return")) as HTMLElement;
    returnBtn?.click();

    expect(
      document.getElementById("screen-campaign-summary")?.style.display,
    ).toBe("flex");
    expect(document.querySelector(".campaign-game-over")).toBeTruthy();
  });

  it("Standard: Start Standard -> Kill Soldier -> Verify DEAD in Roster -> Not in next squad", async () => {
    // 1. Start Standard
    document.getElementById("btn-menu-campaign")?.click();

    const standardCard = Array.from(
      document.querySelectorAll(".difficulty-card"),
    ).find((c) => c.textContent?.includes("Standard")) as HTMLElement;
    standardCard?.click();

    (
      document.querySelector(
        ".campaign-setup-wizard .primary-button",
      ) as HTMLElement
    ).click();

    // 2. Select node and start mission
    const state = cm.getState()!;
    const node = state.nodes.find(
      (n) =>
        n.status === "Accessible" &&
        (n.type === "Combat" || n.type === "Elite" || n.type === "Boss"),
    )!;
    (
      document.querySelector(
        `.campaign-node[data-id="${node.id}"]`,
      ) as HTMLElement
    ).click();

    // Wait for async onCampaignNodeSelected
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.getElementById("screen-equipment")?.style.display).toBe(
      "flex",
    );

    const confBtn = Array.from(
      document.querySelectorAll("#screen-equipment button"),
    ).find((b) => b.textContent?.includes("Confirm")) as HTMLElement;
    confBtn?.click();

    // 3. Kill a soldier
    const deadSoldier = state.roster[0];
    stateUpdateCallback!({
      status: "Won", // Win but with casualty
      t: 100,
      stats: { aliensKilled: 10, scrapGained: 100, threatLevel: 50 },
      units: [
        {
          id: deadSoldier.id,
          name: deadSoldier.name,
          hp: 0,
          maxHp: 100,
          status: "Dead",
          state: UnitState.Dead,
          archetypeId: "assault",
          stats: { hp: 100, speed: 20, accuracy: 80 },
          equipment: { rightHand: "pulse_rifle", leftHand: "combat_knife" },
        },
      ],
      objectives: [],
      settings: {
        debugOverlayEnabled: false,
        debugSnapshots: false,
        timeScale: 1.0,
        isPaused: false,
      },
      map: { width: 10, height: 10, cells: [] },
      enemies: [],
      visibleCells: [],
      discoveredCells: [],
      loot: [],
    });

    // 4. Verify in Roster
    document.getElementById("btn-debrief-continue")?.click();
    expect(
      cm.getState()?.roster.find((s) => s.id === deadSoldier.id)?.status,
    ).toBe("Dead");

    // 5. Select next mission and verify dead soldier cannot be added to squad
    const availableNodes = cm
      .getState()!
      .nodes.filter((n) => n.status === "Accessible");
    const node2 =
      availableNodes.find(
        (n) => n.type === "Combat" || n.type === "Elite" || n.type === "Boss",
      ) || availableNodes[0];

    expect(node2).toBeTruthy();
    const node2El = document.querySelector(
      `.campaign-node[data-id="${node2.id}"]`,
    ) as HTMLElement;
    expect(node2El).toBeTruthy();
    node2El.click();

    // Wait for async onCampaignNodeSelected
    await new Promise((resolve) => setTimeout(resolve, 50));

    document.getElementById("btn-goto-equipment")?.click();

    // In Equipment screen, check the roster picker for dead soldier
    // Select an empty slot
    const emptySlot = Array.from(
      document.querySelectorAll(".soldier-list-panel .menu-item"),
    ).find((el) => el.textContent?.includes("Empty Slot")) as HTMLElement;
    emptySlot?.click();

    // Roster picker is in the right panel
    const rosterItems = Array.from(
      document.querySelectorAll(".armory-panel .menu-item"),
    );
    const deadInRoster = rosterItems.find((el) =>
      el.textContent?.includes(deadSoldier.name),
    );

    // Dead soldiers are filtered out of the Reserve Roster picker (which shows healthy only)
    expect(deadInRoster).toBeFalsy();
  });
});
