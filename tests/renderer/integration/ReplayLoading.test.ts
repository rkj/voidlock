/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UnitState, EngineMode, MissionType } from "@src/shared/types";

// Mock dependencies before importing main.ts
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

// Trigger for GameClient callbacks
// let stateUpdateCallback: ((state: GameState) => void) | null = null;

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
  loadReplay: vi.fn(),
  getReplayData: vi.fn().mockReturnValue({ seed: 123, commands: [] }),
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
  show: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@src/renderer/ui/ModalService", () => ({
  ModalService: vi.fn().mockImplementation(() => mockModalService),
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, cb) => {
    if (typeof cb === "function") {
      cb({ uid: "test-user" });
    } else if (cb && typeof (cb as any).next === "function") {
      (cb as any).next({ uid: "test-user" });
    }
    return () => {};
  }),
  signInAnonymously: vi.fn().mockResolvedValue({ user: { uid: "test-user" } }),
  GoogleAuthProvider: vi.fn(),
  GithubAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  linkWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  getDocs: vi.fn().mockResolvedValue({ forEach: () => {} }),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  serverTimestamp: vi.fn(),
  Timestamp: {
    now: vi.fn(),
    fromDate: vi.fn(),
    toMillis: vi.fn(),
  },
}));

vi.mock("@src/services/firebase", () => ({
  auth: {},
  db: {},
  isFirebaseConfigured: false,
}));

describe("Replay Loading Integration", () => {
  beforeEach(async () => {
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
    }) as unknown as any;

    // Set up DOM
    document.body.innerHTML = `
      <div id="screen-main-menu" class="screen">
        <button id="btn-menu-campaign">Campaign</button>
        <button id="btn-menu-custom">Custom Mission</button>
        <div class="menu-import-section">
            <label for="import-replay">Load Replay JSON</label>
            <input type="file" id="import-replay" accept=".json" />
        </div>
        <p id="menu-version"></p>
      </div>
      <div id="screen-campaign-shell" class="screen">
        <div id="campaign-shell-top-bar"></div>
        <div id="campaign-shell-content">
            <div id="screen-campaign" class="screen"></div>
            <div id="screen-barracks" class="screen"></div>
            <div id="screen-equipment" class="screen"></div>
            <div id="screen-statistics" class="screen"></div>
            <div id="screen-engineering" class="screen"></div>
            <div id="screen-settings" class="screen"></div>
            <div id="screen-mission-setup" class="screen">
                <select id="map-generator-type"></select>
                <input type="number" id="map-seed" />
                <input type="number" id="map-width" />
                <input type="number" id="map-height" />
                <input type="range" id="map-spawn-points" />
                <input type="range" id="map-starting-threat" />
                <input type="range" id="map-base-enemies" />
                <input type="range" id="map-enemy-growth" />
                <input type="checkbox" id="toggle-fog-of-war" />
                <input type="checkbox" id="toggle-debug-overlay" />
                <input type="checkbox" id="toggle-los-overlay" />
                <input type="checkbox" id="toggle-agent-control" />
                <input type="checkbox" id="toggle-manual-deployment" />
                <input type="checkbox" id="toggle-allow-tactical-pause" />
            </div>
        </div>
      </div>
      <div id="screen-mission" class="screen">
        <div id="top-bar">
            <button id="btn-pause-toggle"></button>
            <input type="range" id="game-speed" />
        </div>
        <div id="soldier-panel"><div id="soldier-list"></div></div>
        <canvas id="game-canvas"></canvas>
        <div id="right-panel"></div>
      </div>
      <div id="screen-debrief" class="screen"></div>
      <div id="screen-campaign-summary" class="screen"></div>
      <div id="modal-container"></div>
    `;

    if (window.GameAppInstance) {
      window.GameAppInstance.stop();
      window.GameAppInstance = undefined;
    }

    localStorage.clear();

    // Import main.ts
    vi.resetModules();
    await import("@src/renderer/main");

    // Wait for GameApp to initialize
    await new Promise((resolve) => setTimeout(resolve, 300));

    document.dispatchEvent(new Event("DOMContentLoaded"));
  });

  it("should load a replay JSON and transition to Debrief Screen", async () => {
    const replayFileContent = JSON.stringify({
      replayData: {
        seed: 456,
        missionType: MissionType.DestroyHive,
        map: { width: 10, height: 10, cells: [] },
        squadConfig: { soldiers: [], inventory: {} },
        commands: [],
      },
      currentState: {
        status: "Won",
        t: 120000,
        seed: 456,
        missionType: MissionType.DestroyHive,
        stats: {
          aliensKilled: 25,
          scrapGained: 150,
          threatLevel: 10,
          elitesKilled: 2,
          casualties: 0,
        },
        units: [
          {
            id: "u1",
            name: "Alpha",
            tacticalNumber: 1,
            hp: 100,
            maxHp: 100,
            kills: 10,
            state: UnitState.Idle,
            pos: { x: 0, y: 0 },
          },
        ],
        objectives: [],
        settings: { mode: EngineMode.Simulation },
        map: { width: 10, height: 10, cells: [] },
        enemies: [],
        visibleCells: [],
        discoveredCells: [],
        loot: [],
        mines: [],
        turrets: [],
        squadInventory: {},
      },
      version: "1.0.0",
    });

    const file = new File([replayFileContent], "replay.json", {
      type: "application/json",
    });
    const input = document.getElementById("import-replay") as HTMLInputElement;

    // Mock FileReader globally
    const mockReader = {
      readAsText: vi.fn(),
      onload: null as any,
      result: null as any,
    };
    mockReader.readAsText.mockImplementation(() => {
      mockReader.result = replayFileContent;
      if (mockReader.onload) {
        mockReader.onload({ target: { result: replayFileContent } });
      }
    });
    vi.stubGlobal(
      "FileReader",
      vi.fn(() => mockReader),
    );

    // Trigger change event
    Object.defineProperty(input, "files", {
      value: [file],
    });
    input.dispatchEvent(new Event("change", { bubbles: true }));

    // Wait for async processing
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Verify transition to Debrief Screen
    const debriefScreen = document.getElementById("screen-debrief");
    expect(debriefScreen?.style.display).toBe("flex");

    // Verify Mission Stats on screen
    expect(debriefScreen?.innerHTML).toContain("MISSION SUCCESS");
    expect(debriefScreen?.innerHTML).toContain("25"); // Aliens killed
    expect(debriefScreen?.innerHTML).toContain("150"); // Scrap

    // Verify GameClient.loadReplay was called with correct data
    expect(mockGameClient.loadReplay).toHaveBeenCalledWith(
      expect.objectContaining({
        seed: 456,
        missionType: MissionType.DestroyHive,
      }),
    );

    vi.unstubAllGlobals();
  });

  it("should load a replay-only JSON (no currentState) and still transition to Debrief Screen", async () => {
    const replayFileContent = JSON.stringify({
      seed: 789,
      missionType: MissionType.RecoverIntel,
      map: { width: 8, height: 8, cells: [] },
      squadConfig: {
        soldiers: [{ archetypeId: "assault", name: "Sarge" }],
        inventory: {},
      },
      commands: [{ t: 5000, cmd: { type: "STOP", unitIds: ["u1"] } }],
    });

    const file = new File([replayFileContent], "replay_only.json", {
      type: "application/json",
    });
    const input = document.getElementById("import-replay") as HTMLInputElement;

    // Mock FileReader globally
    const mockReader = {
      readAsText: vi.fn(),
      onload: null as any,
      result: null as any,
    };
    mockReader.readAsText.mockImplementation(() => {
      mockReader.result = replayFileContent;
      if (mockReader.onload) {
        mockReader.onload({ target: { result: replayFileContent } });
      }
    });
    vi.stubGlobal(
      "FileReader",
      vi.fn(() => mockReader),
    );

    // Trigger change event
    Object.defineProperty(input, "files", {
      value: [file],
    });
    input.dispatchEvent(new Event("change", { bubbles: true }));

    // Wait for async processing
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Verify transition to Debrief Screen
    const debriefScreen = document.getElementById("screen-debrief");
    expect(debriefScreen?.style.display).toBe("flex");

    // Verify MISSION SUCCESS (default)
    expect(debriefScreen?.innerHTML).toContain("MISSION SUCCESS");
    expect(debriefScreen?.innerHTML).toContain("SARGE");

    // Verify GameClient.loadReplay was called with correct data
    expect(mockGameClient.loadReplay).toHaveBeenCalledWith(
      expect.objectContaining({
        seed: 789,
        missionType: MissionType.RecoverIntel,
      }),
    );

    vi.unstubAllGlobals();
  });
});
