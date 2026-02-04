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

describe("E2E Campaign Happy Path", () => {
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
              <div id="screen-settings" class="screen" style="display:none"></div>
          </div>
      </div>

      <div id="screen-mission-setup" class="screen" style="display:none">
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

  it("should play through a full Standard campaign to victory", async () => {
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

    expect(cm.getState()?.status).toBe("Active");
    expect(cm.getState()?.roster.length).toBe(4);
    expect(cm.getState()?.currentSector).toBe(1);

    let loopCount = 0;
    const MAX_LOOPS = 50;
    let lastSector = 1;

    while (cm.getState()?.status === "Active" && loopCount < MAX_LOOPS) {
      loopCount++;
      const state = cm.getState()!;

      // 2. Select an accessible node
      const accessibleNode = state.nodes.find((n) => n.status === "Accessible");
      expect(accessibleNode).toBeTruthy();

      const nodeEl = document.querySelector(
        `.campaign-node[data-id="${accessibleNode!.id}"]`,
      ) as HTMLElement;
      expect(nodeEl).toBeTruthy();
      nodeEl.click();

      // Wait for async onCampaignNodeSelected
      await new Promise((resolve) => setTimeout(resolve, 50));
      // If we are still on campaign screen, it was a Shop or non-ambush Event that got resolved immediately
      if (
        document.getElementById("screen-campaign")?.style.display !== "none"
      ) {
        continue;
      }

      // 3. Handle Mission Setup
      expect(
        document.getElementById("screen-mission-setup")?.style.display,
      ).toBe("flex");

      // Ensure squad is selected
      const soldierCards = document.querySelectorAll(".soldier-card");
      soldierCards.forEach((card) => {
        if (
          !card.classList.contains("selected") &&
          !card.classList.contains("disabled")
        ) {
          card.dispatchEvent(new Event("dblclick"));
        }
      });

      // Launch to Equipment
      document.getElementById("btn-goto-equipment")?.click();
      expect(document.getElementById("screen-equipment")?.style.display).toBe(
        "flex",
      );

      // Confirm and Launch mission
      const equipmentLaunchBtn = Array.from(
        document.querySelectorAll("#screen-equipment button"),
      ).find((b) => b.textContent?.includes("Confirm")) as HTMLElement;
      expect(equipmentLaunchBtn).toBeTruthy();
      equipmentLaunchBtn?.click();

      // 4. Mission Screen
      expect(document.getElementById("screen-mission")?.style.display).toBe(
        "flex",
      );

      // We need an initial state update to render the HUD and Debug Tools
      stateUpdateCallback!(
        createMockState({
          units: cm
            .getState()!
            .roster.filter((s) => s.status === "Healthy")
            .slice(0, 4)
            .map((s) => ({
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

      // Simulate Force Win via Debug Overlay
      const debugWinBtn = document.getElementById("btn-force-win");
      expect(debugWinBtn).toBeTruthy();
      debugWinBtn?.click();

      expect(mockGameClient.forceWin).toHaveBeenCalled();

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
              damageDealt: 0,
              objectivesCompleted: 0,
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

      // 6. Check Transition
      const currentCmState = cm.getState()!;
      if (currentCmState.status === "Victory") {
        expect(
          document.getElementById("screen-campaign-summary")?.style.display,
        ).toBe("flex");
      } else {
        expect(document.getElementById("screen-campaign")?.style.display).toBe(
          "flex",
        );

        // Verify progression to next sector
        expect(currentCmState.currentSector).toBeGreaterThanOrEqual(lastSector);
        lastSector = currentCmState.currentSector;
      }
    }

    // 7. Final Verification
    expect(cm.getState()?.status).toBe("Victory");
    expect(
      document.getElementById("screen-campaign-summary")?.style.display,
    ).toBe("flex");
    expect(document.querySelector(".campaign-victory-overlay")).toBeTruthy();

    expect(loopCount).toBeGreaterThan(5);
  });
});
