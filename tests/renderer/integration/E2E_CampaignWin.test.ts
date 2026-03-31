/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import {
  UnitState,
  GameState,
  MissionType,
  EngineMode,
  AIProfile,
  CommandType,
} from "@src/shared/types";
import { GameApp } from "@src/renderer/app/GameApp";

// Mock dependencies
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

// Trigger for GameClient callbacks
let stateUpdateCallback: ((state: GameState) => void) | null = null;

const mockGameClient = {
  init: vi.fn(), pause: vi.fn(), resume: vi.fn(),
  freezeForDialog: vi.fn(),
  unfreezeAfterDialog: vi.fn(),
  queryState: vi.fn(),
  onStateUpdate: vi.fn((cb) => {
    stateUpdateCallback = cb;
  }),
  stop: vi.fn(),
  getIsPaused: vi.fn().mockReturnValue(false),
  getTargetScale: vi.fn().mockReturnValue(1.0),
  getTimeScale: vi.fn().mockReturnValue(1.0),
  setTimeScale: vi.fn(),
  togglePause: vi.fn(),
  toggleDebugOverlay: vi.fn(),
  toggleLosOverlay: vi.fn(),
  getReplayData: vi.fn().mockReturnValue({ seed: 123, commands: [] }),
  applyCommand: vi.fn(),
  seek: vi.fn(),
  getFullState: vi.fn(),
  setTickRate: vi.fn(),
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
  
  return {
    ThemeManager: mockConstructor,
  };
});

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

describe("E2E Campaign Happy Path", () => {
  let storage: MockStorageProvider;
  let app: GameApp;

  beforeEach(async () => {
    storage = new MockStorageProvider();
    
    new CampaignManager(storage, new MetaManager(new MockStorageProvider()));

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
              <div id="screen-engineering" class="screen" style="display:none"></div>
          </div>
      </div>

      <div id="screen-mission-setup" class="screen screen-centered" style="display:none">
        <h1>Mission Configuration</h1>
        <div id="unit-style-preview"></div>
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
        <button id="btn-launch-mission" class="primary-button">Launch Mission</button>
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
        debugSnapshots: false,
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

  it("should play through a full Standard campaign to victory", async () => {
    const cm = app.registry.campaignManager;

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

    expect(cm.getState()?.status).toBe("Active");
    expect(cm.getState()?.roster.length).toBe(4);
    expect(cm.getState()?.currentSector).toBe(1);

    // 2. Select an accessible node
    const state = cm.getState()!;
    const accessibleNode = state.nodes.find((n) => n.status === "Accessible");
    expect(accessibleNode).toBeTruthy();

    // Ensure currentNodeId is set (renderer doesn't call selectNode)
    cm.selectNode(accessibleNode!.id);

    const nodeEl = document.querySelector(
      `.campaign-node[data-id="${accessibleNode!.id}"]`,
    ) as HTMLElement;
    expect(nodeEl).toBeTruthy();
    nodeEl.click();

    // Wait for async onCampaignNodeSelected
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 3. Handle Equipment
    expect(document.getElementById("screen-equipment")?.style.display).toBe(
      "flex",
    );

    const equipmentBtn = Array.from(
      document.querySelectorAll("#screen-equipment button"),
    ).find((b) =>
      b.textContent?.includes("Authorize Operation") ||
      b.textContent?.includes("Exit Hub")
    ) as HTMLElement;

    expect(equipmentBtn).toBeTruthy();
    equipmentBtn?.click();

    // Wait for mission launch
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 4. Mission Screen
    expect(document.getElementById("screen-mission")?.style.display).toBe(
      "flex",
    );

    // Mock the engine response for winning
    stateUpdateCallback!(
      createMockState({
        status: "Won",
        t: 100,
        stats: {
          aliensKilled: 10,
          elitesKilled: 0,
          scrapGained: 100,
          threatLevel: 0,
          casualties: 0,
        },
        units: cm
          .getState()!
          .roster.filter((s) => s.status === "Healthy")
          .slice(0, 4)
          .map((s) => ({
            id: s.id,
            hp: s.maxHp,
            maxHp: s.maxHp,
            kills: 2,
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
            damageDealt: 0, objectivesCompleted: 0, positionHistory: [],
          })),
        nodeType: accessibleNode!.type,
      }),
    );

    // 5. Debrief Screen
    expect(document.getElementById("screen-debrief")?.style.display).toBe(
      "flex",
    );

    const returnBtn = Array.from(
      document.querySelectorAll("#screen-debrief button"),
    ).find((b) => b.textContent?.includes("Return")) as HTMLElement;
    expect(returnBtn).toBeTruthy();
    returnBtn?.click();

    await new Promise((resolve) => setTimeout(resolve, 100));

    // 6. After debrief return, verify campaign progresses
    const currentCmState = cm.getState()!;
    expect(currentCmState.status).toBe("Active");
    expect(currentCmState.history.length).toBeGreaterThanOrEqual(1);

    // 7. Force victory by manipulating campaign state directly and verify UI
    const bossNode = currentCmState.nodes.find((n) => n.type === "Boss");
    expect(bossNode).toBeTruthy();
    bossNode!.status = "Accessible";
    cm.selectNode(bossNode!.id);

    // Simulate boss mission win via reconciler
    cm.reconcileMission({
      nodeId: bossNode!.id,
      result: "Won",
      won: true,
      kills: 50,
      aliensKilled: 50,
      scrapGained: 1000,
      intelGained: 5,
      timeSpent: 200,
      soldierResults: [],
      casualties: [],
    } as any);

    expect(cm.getState()?.status).toBe("Victory");
  }, 30000);
});
