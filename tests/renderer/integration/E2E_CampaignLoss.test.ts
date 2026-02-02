/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CampaignManager } from "@src/engine/managers/CampaignManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import {
  UnitState,
  GameState,
  MissionType,
  EngineMode,
  AIProfile,
} from "@src/shared/types";
import { GameApp } from "@src/renderer/app/GameApp";

// Mock dependencies
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

// Trigger for GameClient callbacks
let stateUpdateCallback: ((state: GameState) => void) | null = null;

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

vi.mock("@src/renderer/ui/EventModal", () => ({
  EventModal: vi.fn().mockImplementation((_modalService, onChoice) => ({
    show: vi.fn().mockImplementation((event) => {
      // Automatically pick first choice
      onChoice(event.choices[0]);
    }),
    hide: vi.fn(),
  })),
  OutcomeModal: vi.fn().mockImplementation((_modalService, onConfirm) => ({
    show: vi.fn().mockImplementation(() => {
      onConfirm();
    }),
    hide: vi.fn(),
  })),
}));

describe("E2E Campaign Failure Modes", () => {
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
            <input type="number" id="map-width" value="14" />
            <input type="number" id="map-height" value="14" />
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

  const createMockState = (overrides: Partial<GameState>): GameState => {
    return {
      t: 0,
      seed: 123,
      missionType: MissionType.Default,
      map: {
        width: 10,
        height: 10,
        cells: [],
        generatorName: "Procedural",
        boundaries: [],
        doors: [],
        walls: [],
        spawnPoints: [],
      },
      units: [],
      enemies: [],
      visibleCells: [],
      discoveredCells: [],
      objectives: [],
      stats: {
        threatLevel: 0,
        aliensKilled: 0,
        elitesKilled: 0,
        scrapGained: 0,
        casualties: 0,
      },
      status: "Playing",
      settings: {
        mode: EngineMode.Simulation,
        debugOverlayEnabled: true,
        losOverlayEnabled: false,
        timeScale: 1.0,
        isPaused: false,
        isSlowMotion: false,
        allowTacticalPause: true,
      },
      squadInventory: {},
      loot: [],
      mines: [],
      turrets: [],
      ...overrides,
    };
  };

  it("Ironman: Start Ironman -> Force Lose -> Verify Defeat", async () => {
    const cm = CampaignManager.getInstance();

    // 1. Start Ironman Campaign
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
    startBtn?.click();

    expect(cm.getState()?.rules.difficulty).toBe("Ironman");

    // 2. Select an accessible node
    const state = cm.getState()!;
    const accessibleNode = state.nodes.find(
      (n) =>
        n.status === "Accessible" &&
        (n.type === "Combat" || n.type === "Elite" || n.type === "Boss"),
    );
    expect(accessibleNode).toBeTruthy();

    const nodeEl = document.querySelector(
      `.campaign-node[data-id="${accessibleNode!.id}"]`,
    ) as HTMLElement;
    expect(nodeEl).toBeTruthy();
    nodeEl.click();

    // Wait for async onCampaignNodeSelected
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 3. Handle Mission Setup
    expect(document.getElementById("screen-mission-setup")?.style.display).toBe(
      "flex",
    );

    const soldierCards = document.querySelectorAll(".soldier-card");
    soldierCards.forEach((card) => {
      if (
        !card.classList.contains("deployed") &&
        !card.classList.contains("disabled")
      ) {
        card.dispatchEvent(new Event("dblclick"));
      }
    });

    // Launch to Equipment
    document.getElementById("btn-goto-equipment")?.click();

    // Confirm and Launch mission
    const equipmentLaunchBtn = Array.from(
      document.querySelectorAll("#screen-equipment button"),
    ).find((b) => b.textContent?.includes("Confirm")) as HTMLElement;
    equipmentLaunchBtn?.click();

    // 4. Mission Screen
    expect(document.getElementById("screen-mission")?.style.display).toBe(
      "flex",
    );

    // Initial state update
    stateUpdateCallback!(
      createMockState({
        units: cm.getState()!.roster.map((s) => ({
          id: s.id,
          hp: s.maxHp,
          maxHp: s.maxHp,
          kills: 0,
          state: UnitState.Idle,
          pos: { x: 0, y: 0 },
          stats: {
            speed: 20,
            damage: 10,
            fireRate: 1,
            accuracy: 80,
            soldierAim: 80,
            sightRange: 10,
            range: 10,
            attackRange: 10,
            equipmentAccuracyBonus: 0,
          },
          engagementPolicy: "ENGAGE",
          archetypeId: s.archetypeId,
          aiProfile: AIProfile.STAND_GROUND,
          commandQueue: [],
          damageDealt: 0,
          objectivesCompleted: 0,
        })),
        nodeType: accessibleNode!.type,
      }),
    );

    // 5. Simulate Force Lose
    const debugLoseBtn = document.getElementById("btn-force-lose");
    expect(debugLoseBtn).toBeTruthy();
    debugLoseBtn?.click();

    expect(mockGameClient.forceLose).toHaveBeenCalled();

    // Mock the engine response for losing
    stateUpdateCallback!(
      createMockState({
        status: "Lost",
        t: 100,
        stats: {
          aliensKilled: 0,
          elitesKilled: 0,
          scrapGained: 0,
          threatLevel: 0,
          casualties: 4,
        },
        units: cm.getState()!.roster.map((s) => ({
          id: s.id,
          hp: 0, // All dead
          maxHp: s.maxHp,
          kills: 0,
          state: UnitState.Dead,
          pos: { x: 0, y: 0 },
          stats: {
            speed: 20,
            damage: 10,
            fireRate: 1,
            accuracy: 80,
            soldierAim: 80,
            sightRange: 10,
            range: 10,
            attackRange: 10,
            equipmentAccuracyBonus: 0,
          },
          engagementPolicy: "ENGAGE",
          archetypeId: s.archetypeId,
          aiProfile: AIProfile.STAND_GROUND,
          commandQueue: [],
          damageDealt: 0,
          objectivesCompleted: 0,
        })),
        nodeType: accessibleNode!.type,
      }),
    );

    // 6. Debrief Screen
    expect(document.getElementById("screen-debrief")?.style.display).toBe(
      "flex",
    );

    const returnBtn = Array.from(
      document.querySelectorAll("#screen-debrief button"),
    ).find((b) => b.textContent?.includes("Return")) as HTMLElement;
    returnBtn?.click();

    // 7. Verify Campaign Defeat Summary
    expect(cm.getState()?.status).toBe("Defeat");
    expect(
      document.getElementById("screen-campaign-summary")?.style.display,
    ).toBe("flex");
    expect(document.querySelector(".campaign-game-over")).toBeTruthy();

    // 8. Abandon Expedition and verify save is deleted
    const abandonBtn = Array.from(
      document.querySelectorAll("#screen-campaign-summary button"),
    ).find((b) => b.textContent?.includes("Abandon Expedition")) as HTMLElement;
    expect(abandonBtn).toBeTruthy();
    abandonBtn?.click();

    expect(cm.getState()).toBeNull();
    expect(document.getElementById("screen-main-menu")?.style.display).toBe(
      "flex",
    );
  });

  it("Standard: Start Standard -> Kill Soldier -> Verify DEAD in Roster -> Not in next squad", async () => {
    const cm = CampaignManager.getInstance();

    // 1. Start Standard Campaign
    document.getElementById("btn-menu-campaign")?.click();

    const standardCard = Array.from(
      document.querySelectorAll(".difficulty-card"),
    ).find((c) => c.textContent?.includes("Standard")) as HTMLElement;
    expect(standardCard).toBeTruthy();
    standardCard?.click();

    const startBtn = document.querySelector(
      ".campaign-setup-wizard .primary-button",
    ) as HTMLElement;
    startBtn?.click();

    expect(cm.getState()?.rules.difficulty).toBe("Standard");
    const deadSoldierId = cm.getState()!.roster[0].id;

    // 2. Mission 1: Soldier dies but mission is won (or lost, doesn't matter for this test)
    const state = cm.getState()!;
    const node1 = state.nodes.find(
      (n) =>
        n.status === "Accessible" &&
        (n.type === "Combat" || n.type === "Elite" || n.type === "Boss"),
    )!;
    const node1El = document.querySelector(
      `.campaign-node[data-id="${node1.id}"]`,
    ) as HTMLElement;
    node1El.click();

    // Wait for async onCampaignNodeSelected
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Mission Setup
    const soldierCards = document.querySelectorAll(".soldier-card");
    soldierCards.forEach((card) => {
      if (
        !card.classList.contains("deployed") &&
        !card.classList.contains("disabled")
      ) {
        card.dispatchEvent(new Event("dblclick"));
      }
    });
    document.getElementById("btn-goto-equipment")?.click();
    const equipLaunchBtn = Array.from(
      document.querySelectorAll("#screen-equipment button"),
    ).find((b) => b.textContent?.includes("Confirm")) as HTMLElement;
    equipLaunchBtn?.click();

    // Mission Screen
    stateUpdateCallback!(
      createMockState({
        units: cm.getState()!.roster.map((s) => ({
          id: s.id,
          hp: s.maxHp,
          maxHp: s.maxHp,
          kills: 0,
          state: UnitState.Idle,
          pos: { x: 0, y: 0 },
          stats: {
            speed: 20,
            damage: 10,
            fireRate: 1,
            accuracy: 80,
            soldierAim: 80,
            sightRange: 10,
            range: 10,
            attackRange: 10,
            equipmentAccuracyBonus: 0,
          },
          engagementPolicy: "ENGAGE",
          archetypeId: s.archetypeId,
          aiProfile: AIProfile.STAND_GROUND,
          commandQueue: [],
          damageDealt: 0,
          objectivesCompleted: 0,
        })),
      }),
    );

    // End mission with one dead soldier
    stateUpdateCallback!(
      createMockState({
        status: "Won",
        units: cm.getState()!.roster.map((s) => ({
          id: s.id,
          hp: s.id === deadSoldierId ? 0 : s.maxHp,
          maxHp: s.maxHp,
          kills: 1,
          state: s.id === deadSoldierId ? UnitState.Dead : UnitState.Idle,
          pos: { x: 0, y: 0 },
          stats: {
            speed: 20,
            damage: 10,
            fireRate: 1,
            accuracy: 80,
            soldierAim: 80,
            sightRange: 10,
            range: 10,
            attackRange: 10,
            equipmentAccuracyBonus: 0,
          },
          engagementPolicy: "ENGAGE",
          archetypeId: s.archetypeId,
          aiProfile: AIProfile.STAND_GROUND,
          commandQueue: [],
          damageDealt: 0,
          objectivesCompleted: 0,
        })),
      }),
    );

    // Debrief
    expect(document.getElementById("screen-debrief")?.style.display).toBe(
      "flex",
    );
    const returnBtn = Array.from(
      document.querySelectorAll("#screen-debrief button"),
    ).find((b) => b.textContent?.includes("Return")) as HTMLElement;
    returnBtn?.click();

    // 3. Verify Roster status
    const deadSoldier = cm
      .getState()!
      .roster.find((s) => s.id === deadSoldierId);
    expect(deadSoldier?.status).toBe("Dead");

    // 4. Mission 2: Verify dead soldier is NOT in squad selection
    const availableNodes = cm.getState()!.nodes.filter(n => n.status === "Accessible");
    const node2 = availableNodes.find(
        (n) => (n.type === "Combat" || n.type === "Elite" || n.type === "Boss"),
    ) || availableNodes[0];
    
    expect(node2).toBeTruthy();
    const node2El = document.querySelector(
      `.campaign-node[data-id="${node2.id}"]`,
    ) as HTMLElement;
    expect(node2El).toBeTruthy();
    node2El.click();

    // Wait for async onCampaignNodeSelected
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.getElementById("screen-mission-setup")?.style.display).toBe(
      "flex",
    );

    // Check squad builder
    const rosterCards = document.querySelectorAll(
      "#squad-builder .soldier-card",
    );
    const deadCard = Array.from(rosterCards).find((c) =>
      c.querySelector("strong")?.textContent?.includes(deadSoldier!.name),
    );
    expect(deadCard).toBeTruthy();
    expect(deadCard?.classList.contains("disabled")).toBe(true);
    expect(deadCard?.classList.contains("deployed")).toBe(false);

    // Try to double click the dead card
    deadCard?.dispatchEvent(new Event("dblclick"));

    // Check active squad again - should still not have the dead soldier
    const activeSquadSlotsAfterClick = document.querySelectorAll(".squad-slot");
    const deadInSquadAfterClick = Array.from(activeSquadSlotsAfterClick).some(
      (slot) =>
        slot.querySelector("strong")?.textContent?.includes(deadSoldier!.name),
    );
    expect(deadInSquadAfterClick).toBe(false);
  });
});
