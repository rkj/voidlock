/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CampaignManager } from "@src/engine/managers/CampaignManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { UnitState } from "@src/shared/types";

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

describe("Full Campaign Flow Integration", () => {
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

    // Set up DOM
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
          </div>
      </div>

      <div id="screen-mission-setup" class="screen" style="display:none">
        <div id="map-config-section">
          <select id="map-generator-type">
            <option value="Procedural">Procedural</option>
          </select>
          <input type="number" id="map-seed" />
          <div id="preset-map-controls">
            <input type="number" id="map-width" value="10" />
            <input type="number" id="map-height" value="10" />
            <input type="number" id="map-spawn-points" value="1" />
            <input type="range" id="map-starting-threat" value="0" />
            <span id="map-starting-threat-value">0</span>
          </div>
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
          <span id="speed-value">1.0x</span>
          <button id="btn-give-up">Give Up</button>
        </div>
        <div id="soldier-list"></div>
        <canvas id="game-canvas"></canvas>
        <div id="right-panel"></div>
      </div>
      <div id="screen-debrief" class="screen" style="display:none"></div>
      <div id="screen-campaign-summary" class="screen" style="display:none"></div>
    `;

    // Mock window.confirm
    window.confirm = vi.fn().mockReturnValue(true);
    // Mock window.alert
    window.alert = vi.fn();
    // Mock window.prompt
    window.prompt = vi.fn().mockReturnValue("New Recruit");

    localStorage.clear();

    app = new GameApp();
    await app.initialize();
    app.start();
  });

  afterEach(() => {
    app.stop();
  });

  it("should complete a full campaign flow with roster validation", async () => {
    const cm = CampaignManager.getInstance();

    // 1. Start Standard Campaign
    document.getElementById("btn-menu-campaign")?.click();
    expect(document.getElementById("screen-campaign")?.style.display).toBe(
      "flex",
    );

    const standardCard = Array.from(
      document.querySelectorAll(".difficulty-card"),
    ).find((c) => c.textContent?.includes("Standard")) as HTMLElement;
    expect(standardCard).toBeTruthy();
    standardCard?.click();

    const startBtn = document.querySelector(
      ".campaign-setup-wizard .primary-button",
    ) as HTMLElement;
    expect(startBtn).toBeTruthy();
    startBtn?.click();

    const state = cm.getState();
    expect(state).toBeTruthy();
    expect(state?.rules.difficulty).toBe("Standard");
    expect(state?.roster.length).toBe(4);

    // 2. Force Lose a mission with casualties
    const accessibleCombatNode = cm
      .getState()
      ?.nodes.find(
        (n) =>
          n.status === "Accessible" &&
          (n.type === "Combat" || n.type === "Elite" || n.type === "Boss"),
      );
    const firstNode = document.querySelector(
      `.campaign-node[data-id="${accessibleCombatNode?.id}"]`,
    ) as HTMLElement;
    firstNode?.click();

    // Wait for async onCampaignNodeSelected
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.getElementById("screen-mission-setup")?.style.display).toBe(
      "flex",
    );

    const soldierCards = document.querySelectorAll(".soldier-card");
    soldierCards.forEach((card) => {
      if (!card.classList.contains("deployed")) {
        card.dispatchEvent(new Event("dblclick"));
      }
    });

    document.getElementById("btn-goto-equipment")?.click();
    const equipmentLaunchBtn = Array.from(
      document.querySelectorAll("#screen-equipment button"),
    ).find((b) => b.textContent?.includes("Confirm")) as HTMLElement;
    equipmentLaunchBtn?.click();

    expect(document.getElementById("screen-mission")?.style.display).toBe(
      "flex",
    );

    const deadSoldierId = cm.getState()!.roster[0].id;
    stateUpdateCallback!({
      status: "Lost",
      t: 100,
      stats: { aliensKilled: 5, scrapGained: 50, threatLevel: 80 },
      units: [
        {
          id: deadSoldierId,
          hp: 0,
          maxHp: 100,
          kills: 2,
          state: UnitState.Dead,
          pos: { x: 0, y: 0 },
          stats: { speed: 20 },
        },
        {
          id: cm.getState()!.roster[1].id,
          hp: 50,
          maxHp: 100,
          kills: 1,
          state: UnitState.Idle,
          pos: { x: 1, y: 1 },
          stats: { speed: 20 },
        },
        {
          id: cm.getState()!.roster[2].id,
          hp: 100,
          maxHp: 100,
          kills: 1,
          state: UnitState.Idle,
          pos: { x: 2, y: 2 },
          stats: { speed: 20 },
        },
        {
          id: cm.getState()!.roster[3].id,
          hp: 100,
          maxHp: 100,
          kills: 1,
          state: UnitState.Idle,
          pos: { x: 3, y: 3 },
          stats: { speed: 20 },
        },
      ],
      objectives: [],
      settings: { debugOverlayEnabled: false, timeScale: 1.0, isPaused: false },
      map: { width: 10, height: 10, cells: [] },
      enemies: [],
      visibleCells: [],
      discoveredCells: [],
      loot: [],
    });

    expect(document.getElementById("screen-debrief")?.style.display).toBe(
      "flex",
    );
    expect(
      cm.getState()?.roster.find((s) => s.id === deadSoldierId)?.status,
    ).toBe("Dead");

    // 3. Verify Dead soldiers are NOT in the next Mission Setup squad
    const returnBtn = Array.from(
      document.querySelectorAll("#screen-debrief button"),
    ).find((b) => b.textContent?.includes("Return")) as HTMLElement;
    returnBtn?.click();

    expect(document.getElementById("screen-campaign")?.style.display).toBe(
      "flex",
    );

    const nextCombatNode = cm
      .getState()
      ?.nodes.find(
        (n) =>
          n.status === "Accessible" &&
          (n.type === "Combat" || n.type === "Elite" || n.type === "Boss"),
      );
    const nextNode = document.querySelector(
      `.campaign-node[data-id="${nextCombatNode?.id}"]`,
    ) as HTMLElement;
    nextNode?.click();

    // Wait for async onCampaignNodeSelected
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.getElementById("screen-mission-setup")?.style.display).toBe(
      "flex",
    );

    const selectedCards = document.querySelectorAll(".soldier-card.deployed");
    const isS0Selected = Array.from(selectedCards).some((c) =>
      (c as HTMLElement).textContent?.includes("Recruit 1"),
    );
    expect(isS0Selected).toBe(false);

    // 4. Verify Boss Win triggers Victory screen
    const bossState = cm.getState()!;
    const bossNode = bossState.nodes.find((n) => n.type === "Boss")!;
    bossNode.status = "Accessible";
    cm.save();

    // Force re-render of campaign screen by going back to menu and in again
    document.getElementById("btn-setup-back")?.click();
    document.getElementById("btn-menu-campaign")?.click();

    const bossNodeEl = document.querySelector(
      `.campaign-node[data-id="${bossNode.id}"]`,
    ) as HTMLElement;
    expect(bossNodeEl).toBeTruthy();
    bossNodeEl.click();

    // Wait for async onCampaignNodeSelected
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Re-select squad
    document.querySelectorAll(".soldier-card").forEach((card) => {
      if (
        !card.classList.contains("deployed") &&
        !card.classList.contains("disabled")
      ) {
        card.dispatchEvent(new Event("dblclick"));
      }
    });
    document.getElementById("btn-goto-equipment")?.click();
    (
      Array.from(document.querySelectorAll("#screen-equipment button")).find(
        (b) => b.textContent?.includes("Confirm"),
      ) as HTMLElement
    ).click();

    stateUpdateCallback!({
      status: "Won",
      t: 200,
      stats: { aliensKilled: 50, scrapGained: 1000, threatLevel: 0 },
      units: [
        {
          id: cm.getState()!.roster[1].id,
          hp: 100,
          maxHp: 100,
          kills: 20,
          state: UnitState.Idle,
          pos: { x: 0, y: 0 },
          stats: { speed: 20 },
        },
      ],
      objectives: [],
      settings: { debugOverlayEnabled: false, timeScale: 1.0, isPaused: false },
      map: { width: 10, height: 10, cells: [] },
      enemies: [],
      visibleCells: [],
      discoveredCells: [],
      loot: [],
    });

    expect(cm.getState()?.status).toBe("Victory");
    const returnFromBossBtn = Array.from(
      document.querySelectorAll("#screen-debrief button"),
    ).find((b) => b.textContent?.includes("Return")) as HTMLElement;
    returnFromBossBtn?.click();

    expect(
      document.getElementById("screen-campaign-summary")?.style.display,
    ).toBe("flex");
    expect(document.querySelector(".campaign-victory-overlay")).toBeTruthy();

    // 5. Verify Bankruptcy triggers Defeat screen
    const summaryBtn = Array.from(
      document.querySelectorAll(".campaign-summary-screen button"),
    ).find(
      (b) =>
        b.textContent?.includes("Retire") || b.textContent?.includes("Abandon"),
    ) as HTMLElement;
    expect(summaryBtn).toBeTruthy();
    summaryBtn?.click();

    expect(document.getElementById("screen-main-menu")?.style.display).toBe(
      "flex",
    );
    document.getElementById("btn-menu-campaign")?.click();
    expect(document.getElementById("screen-campaign")?.style.display).toBe(
      "flex",
    );

    // Choose Standard again
    const standardCard2 = Array.from(
      document.querySelectorAll(".difficulty-card"),
    ).find((c) => c.textContent?.includes("Standard")) as HTMLElement;
    expect(standardCard2).toBeTruthy();
    standardCard2?.click();

    const startBtn2 = document.querySelector(
      ".campaign-setup-wizard .primary-button",
    ) as HTMLElement;
    expect(startBtn2).toBeTruthy();
    startBtn2?.click();

    const bankruptcyState = cm.getState()!;
    expect(bankruptcyState).toBeTruthy();

    // Kill everyone
    bankruptcyState.roster.forEach((s) => (s.status = "Dead"));
    // Spend all scrap
    bankruptcyState.scrap = 50;
    cm.save();

    const bNode = bankruptcyState.nodes.find(
      (n) =>
        n.status === "Accessible" &&
        (n.type === "Combat" || n.type === "Elite" || n.type === "Boss"),
    )!;
    (
      document.querySelector(
        `.campaign-node[data-id="${bNode.id}"]`,
      ) as HTMLElement
    ).click();

    // Wait for async onCampaignNodeSelected
    await new Promise((resolve) => setTimeout(resolve, 50));

    document.getElementById("btn-goto-equipment")?.click();
    const confBtn = Array.from(
      document.querySelectorAll("#screen-equipment button"),
    ).find((b) => b.textContent?.includes("Confirm")) as HTMLElement;
    confBtn?.click();

    expect(document.getElementById("screen-mission")?.style.display).toBe(
      "flex",
    );

    stateUpdateCallback!({
      status: "Lost",
      t: 10,
      stats: { aliensKilled: 0, scrapGained: 0, threatLevel: 100 },
      units: [],
      objectives: [],
      settings: { debugOverlayEnabled: false, timeScale: 1.0, isPaused: false },
      map: { width: 10, height: 10, cells: [] },
      enemies: [],
      visibleCells: [],
      discoveredCells: [],
      loot: [],
    });

    expect(cm.getState()?.status).toBe("Defeat");
    const returnFromDefeatBtn = Array.from(
      document.querySelectorAll("#screen-debrief button"),
    ).find((b) => b.textContent?.includes("Return")) as HTMLElement;
    returnFromDefeatBtn?.click();

    expect(
      document.getElementById("screen-campaign-summary")?.style.display,
    ).toBe("flex");
    expect(document.querySelector(".campaign-game-over")).toBeTruthy();
  });
});
