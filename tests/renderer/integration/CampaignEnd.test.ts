/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UnitState } from "@src/shared/types";

// Mock dependencies before importing main.ts
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

// We need a way to trigger the GameClient callbacks
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
  getReplayData: vi.fn().mockReturnValue({ seed: 12345, commands: [] }),
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

// Mock CampaignManager
const mockCampaignState: any = {
  status: "Active",
  nodes: [
    {
      id: "node-boss",
      type: "Boss",
      status: "Accessible",
      rank: 5,
      difficulty: 3,
      mapSeed: 999,
      connections: [],
      position: { x: 500, y: 0 },
      bonusLootCount: 0,
    },
  ],
  roster: [
    {
      id: "s1",
      name: "Soldier 1",
      archetypeId: "scout",
      status: "Healthy",
      level: 1,
      hp: 100,
      maxHp: 100,
      xp: 0,
      soldierAim: 80,
      equipment: {
        rightHand: "pulse_rifle",
        leftHand: null,
        body: "basic_armor",
        feet: null,
      },
    },
  ],
  scrap: 100,
  intel: 10,
  currentSector: 1,
  currentNodeId: null,
  history: [],
  unlockedArchetypes: ["scout", "heavy", "medic", "demolition"],
  rules: {
    allowTacticalPause: true,
    themeId: "default",
    mode: "Preset",
    difficulty: "Standard",
    deathRule: "Iron",
    mapGeneratorType: "DenseShip",
    difficultyScaling: 1,
    resourceScarcity: 1,
    mapGrowthRate: 1.0,
    baseEnemyCount: 4,
    enemyGrowthPerMission: 1.5,
  },
};

vi.mock("@src/renderer/campaign/CampaignManager", () => {
  return {
    CampaignManager: {
      getInstance: vi.fn().mockReturnValue({
        getState: vi.fn(() => mockCampaignState),
        load: vi.fn(),
        processMissionResult: vi.fn((report) => {
          if (report.result === "Won") {
            const node = mockCampaignState.nodes.find(
              (n: any) => n.id === report.nodeId,
            );
            if (node?.type === "Boss") {
              mockCampaignState.status = "Victory";
            }
            mockCampaignState.history.push(report);
          }
        }),
        save: vi.fn(),
        startNewCampaign: vi.fn(),
        reset: vi.fn(),
        deleteSave: vi.fn(),
        assignEquipment: vi.fn(),
      }),
    },
  };
});

describe("Campaign End Integration", () => {
  beforeEach(async () => {
    // Reset state
    mockCampaignState.status = "Active";
    mockCampaignState.history = [];

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
              <div id="screen-settings" class="screen" style="display:none"></div>
          </div>
      </div>

      <div id="screen-mission-setup" class="screen" style="display:none">
        <div id="map-config-section">
          <select id="map-generator-type">
            <option value="Procedural">Procedural</option>
          </select>
          <input type="number" id="map-seed" />
          <div id="preset-map-controls">
            <input type="number" id="map-width" value="14" />
            <input type="number" id="map-height" value="14" />
            <input type="number" id="map-spawn-points" value="1" />
            <input type="range" id="map-starting-threat" value="0" />
            <span id="map-starting-threat-value">0</span>
          </div>
        </div>
        <div id="unit-style-preview"></div>
        <div id="squad-builder"></div>
        <button id="btn-goto-equipment">Equipment</button>
        <button id="btn-setup-back">Back</button>
      </div>
      <div id="screen-equipment" class="screen" style="display:none"></div>
      <div id="screen-barracks" class="screen" style="display:none"></div>
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

    localStorage.clear();

    // Import main.ts
    vi.resetModules();
    await import("@src/renderer/main");

    // Trigger DOMContentLoaded
    document.dispatchEvent(new Event("DOMContentLoaded"));
  });

  it("should trigger Victory state and show victory report after Boss mission win", async () => {
    // 1. Go to Campaign
    document.getElementById("btn-menu-campaign")?.click();
    expect(document.getElementById("screen-campaign")?.style.display).toBe(
      "flex",
    );

    // 2. Select Boss Node
    const bossNode = document.querySelector(
      ".campaign-node[data-id='node-boss']",
    ) as HTMLElement;
    expect(bossNode).toBeDefined();
    bossNode.click();

    // Wait for async onCampaignNodeSelected
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.getElementById("screen-mission-setup")?.style.display).toBe(
      "flex",
    );

    // 3. Launch Mission (skip Equipment for brevity, trigger CONFIRM directly if possible or just dblclick card)
    const cards = document.querySelectorAll(".soldier-card");
    cards.forEach((card) => card.dispatchEvent(new Event("dblclick")));

    document.getElementById("btn-goto-equipment")?.click();
    const allButtons = document.querySelectorAll("#screen-equipment button");
    const equipmentLaunchBtn = Array.from(allButtons).find((b) =>
      b.textContent?.includes("Confirm"),
    ) as HTMLElement;
    equipmentLaunchBtn?.click();

    expect(document.getElementById("screen-mission")?.style.display).toBe(
      "flex",
    );

    // 4. Trigger Win on Boss Node
    expect(stateUpdateCallback).not.toBeNull();
    stateUpdateCallback!({
      status: "Won",
      t: 100,
      stats: { aliensKilled: 42, scrapGained: 500, threatLevel: 0 },
      units: [
        {
          id: "s1",
          hp: 100,
          maxHp: 100,
          kills: 10,
          state: UnitState.Idle,
          pos: { x: 0, y: 0 },
          stats: { speed: 20 },
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

    expect(document.getElementById("screen-debrief")?.style.display).toBe(
      "flex",
    );
    expect(mockCampaignState.status).toBe("Victory");

    // 5. Return to Campaign Screen (now summary if Victory)
    const continueBtn = Array.from(
      document.querySelectorAll("#screen-debrief button"),
    ).find((b) => b.textContent?.includes("Return")) as HTMLElement;
    continueBtn?.click();

    expect(
      document.getElementById("screen-campaign-summary")?.style.display,
    ).toBe("flex");

    // 6. Verify Victory Report is displayed
    const victoryOverlay = document.querySelector(".campaign-victory-overlay");
    expect(victoryOverlay).not.toBeNull();
    expect(victoryOverlay?.textContent).toContain("Sector Secured");
    expect(victoryOverlay?.textContent).toMatch(/Aliens Killed:\s*42/);
    expect(victoryOverlay?.textContent).toMatch(/Missions:\s*1/);

    // 7. Verify Return to Main Menu works
    const menuBtn = Array.from(
      document.querySelectorAll(".campaign-summary-screen button"),
    ).find((b) =>
      b.textContent?.includes("Retire to Main Menu"),
    ) as HTMLElement;
    expect(menuBtn).toBeDefined();
    menuBtn.click();

    expect(document.getElementById("screen-main-menu")?.style.display).toBe(
      "flex",
    );
  });
});
