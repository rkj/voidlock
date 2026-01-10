/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing main.ts
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" }
}));

// Trigger for GameClient callbacks
let stateUpdateCallback: ((state: any) => void) | null = null;

const mockGameClient = {
  init: vi.fn(),
  onStateUpdate: vi.fn((cb) => { stateUpdateCallback = cb; }),
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

// Mock CampaignManager
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
let currentCampaignState: any = null;

vi.mock("@src/renderer/campaign/CampaignManager", () => {
  return {
    CampaignManager: {
      getInstance: vi.fn().mockReturnValue({
        getState: vi.fn(() => currentCampaignState),
        load: vi.fn(),
        processMissionResult: vi.fn(),
        save: vi.fn(),
        startNewCampaign: vi.fn((seed, diff, pause, theme) => {
          currentCampaignState = {
            status: "Active",
            nodes: [{ id: "node-1", type: "Combat", status: "Accessible", difficulty: 1, mapSeed: 123, connections: [], position: { x: 0, y: 0 } }],
            roster: [
              { id: "s1", name: "Soldier 1", archetypeId: "scout", status: "Healthy", level: 1, hp: 100, maxHp: 100, xp: 0, soldierAim: 80, equipment: { rightHand: "pulse_rifle", leftHand: null, body: "basic_armor", feet: null } }
            ],
            scrap: 100,
            intel: 0,
            currentSector: 1,
            currentNodeId: null,
            history: [],
            unlockedArchetypes: ["scout", "heavy", "medic", "demolition"],
            rules: {
              allowTacticalPause: pause,
              themeId: theme,
              mode: "Preset",
              difficulty: diff,
              deathRule: "Simulation",
              mapGeneratorType: "DenseShip",
              difficultyScaling: 1,
              resourceScarcity: 1,
            },
          };
        }),
        reset: vi.fn(() => { currentCampaignState = null; }),
        deleteSave: vi.fn(() => { currentCampaignState = null; }),
        healSoldier: vi.fn(),
        recruitSoldier: vi.fn((arch, name) => {
           currentCampaignState.roster.push({
             id: "s2", name: name, archetypeId: arch, status: "Healthy", level: 1, hp: 100, maxHp: 100, xp: 0, soldierAim: 70, equipment: {}
           });
           currentCampaignState.scrap -= 100;
        }),
        assignEquipment: vi.fn(),
      }),
    },
  };
});

describe("Comprehensive User Journeys", () => {
  beforeEach(async () => {
    currentCampaignState = null;
    
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
      <div id="screen-campaign" class="screen" style="display:none"></div>
      <div id="screen-barracks" class="screen" style="display:none"></div>
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
      <div id="screen-equipment" class="screen" style="display:none"></div>
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
    `;

    // Mock window.confirm
    window.confirm = vi.fn().mockReturnValue(true);
    // Mock window.alert
    window.alert = vi.fn();
    // Mock window.prompt
    window.prompt = vi.fn().mockReturnValue("New Recruit");

    localStorage.clear();

    // Import main.ts
    vi.resetModules();
    await import("@src/renderer/main");
    
    // Trigger DOMContentLoaded
    document.dispatchEvent(new Event("DOMContentLoaded"));
  });

  it("Journey 1: New Campaign Start Wizard", async () => {
    // 1. Main Menu -> Campaign (empty)
    document.getElementById("btn-menu-campaign")?.click();
    expect(document.getElementById("screen-campaign")?.style.display).toBe("flex");
    
    // Check for wizard
    expect(document.querySelector(".campaign-setup-wizard")).toBeTruthy();
    
    // 2. Setup options and start
    const startBtn = document.querySelector(".campaign-setup-wizard .primary-button") as HTMLElement;
    expect(startBtn.textContent).toContain("INITIALIZE EXPEDITION");
    startBtn.click();
    
    // 3. Should now show the map
    expect(document.querySelector(".campaign-map-viewport")).toBeTruthy();
    expect(document.querySelector(".campaign-node.accessible")).toBeTruthy();
  });

  it("Journey 2: Barracks & Back", async () => {
    // Start campaign first
    document.getElementById("btn-menu-campaign")?.click();
    (document.querySelector(".campaign-setup-wizard .primary-button") as HTMLElement).click();

    // 1. Map -> Barracks
    const barracksBtn = Array.from(document.querySelectorAll("#screen-campaign button")).find(b => b.textContent === "BARRACKS") as HTMLElement;
    barracksBtn.click();
    expect(document.getElementById("screen-barracks")?.style.display).toBe("flex");

    // 2. Recruit a soldier
    const recruitBtn = Array.from(document.querySelectorAll("#screen-barracks .panel:nth-child(3) button")).find(b => b.textContent === "RECRUIT") as HTMLElement;
    recruitBtn.click();
    expect(window.prompt).toHaveBeenCalled();
    
    // Verify roster increased (mocked)
    const rosterItems = document.querySelectorAll("#screen-barracks .panel:first-child .menu-item");
    expect(rosterItems.length).toBe(2);

    // 3. Back to Map
    const backBtn = document.querySelector("#screen-barracks .back-button") as HTMLElement;
    backBtn.click();
    expect(document.getElementById("screen-campaign")?.style.display).toBe("flex");
  });

  it("Journey 3: Custom Mission Give Up Flow", async () => {
    // 1. Main Menu -> Custom Mission Setup
    document.getElementById("btn-menu-custom")?.click();
    
    // 2. Setup -> Mission
    // Choose squad (2 assaults)
    const assaultCard = Array.from(document.querySelectorAll(".soldier-card")).find(c => c.textContent?.includes("Assault")) as HTMLElement;
    assaultCard?.dispatchEvent(new Event("dblclick"));
    assaultCard?.dispatchEvent(new Event("dblclick"));

    document.getElementById("btn-goto-equipment")?.click();
    const equipmentLaunchBtn = Array.from(document.querySelectorAll("#screen-equipment button")).find(b => b.textContent?.includes("CONFIRM")) as HTMLElement;
    equipmentLaunchBtn.click();
    
    expect(document.getElementById("screen-mission")?.style.display).toBe("flex");

    // 3. Mission -> Give Up (Cancel)
    (window.confirm as any).mockReturnValue(false);
    document.getElementById("btn-give-up")?.click();
    expect(document.getElementById("screen-mission")?.style.display).toBe("flex"); // Still in mission

    // 4. Mission -> Give Up (Confirm)
    (window.confirm as any).mockReturnValue(true);
    document.getElementById("btn-give-up")?.click();
    expect(document.getElementById("screen-main-menu")?.style.display).toBe("flex");
  });

  it("Journey 4: Campaign Mission Loss & Game Over", async () => {
    // Start campaign
    document.getElementById("btn-menu-campaign")?.click();
    (document.querySelector(".campaign-setup-wizard .primary-button") as HTMLElement).click();

    // Launch mission
    (document.querySelector(".campaign-node.accessible") as HTMLElement).click();
    const soldierCard = Array.from(document.querySelectorAll(".soldier-card")).find(c => c.textContent?.includes("Soldier 1")) as HTMLElement;
    if (soldierCard && !soldierCard.classList.contains("selected")) {
      soldierCard.dispatchEvent(new Event("dblclick"));
    }
    document.getElementById("btn-goto-equipment")?.click();
    const equipmentLaunchBtn = Array.from(document.querySelectorAll("#screen-equipment button")).find(b => b.textContent?.includes("CONFIRM")) as HTMLElement;
    equipmentLaunchBtn.click();

    // 1. Mission -> Lose
    expect(stateUpdateCallback).not.toBeNull();
    
    // Simulate campaign state change to Defeat in the mock when mission is lost
    // In real code, CampaignManager.processMissionResult would handle this.
    const originalProcess = CampaignManager.getInstance().processMissionResult;
    (CampaignManager.getInstance().processMissionResult as any).mockImplementation(() => {
      currentCampaignState.status = "Defeat";
    });

    stateUpdateCallback!({
      status: "Lost",
      t: 20,
      stats: { aliensKilled: 1, scrapGained: 10, threatLevel: 50 },
      units: [{ id: "s1", hp: 0, maxHp: 100, kills: 0, state: 2, pos: { x: 0, y: 0 }, stats: { speed: 20 } }],
      objectives: [],
      settings: { debugOverlayEnabled: false, timeScale: 1.0, isPaused: false },
      map: { width: 10, height: 10, cells: [] },
      enemies: [],
      visibleCells: [],
      discoveredCells: [],
      loot: [],
    });

    expect(document.getElementById("screen-debrief")?.style.display).toBe("flex");

    // 2. Debrief -> Campaign (Game Over)
    const returnBtn = Array.from(document.querySelectorAll("#screen-debrief button")).find(b => b.textContent?.includes("RETURN")) as HTMLElement;
    returnBtn.click();

    expect(document.getElementById("screen-campaign")?.style.display).toBe("flex");
    expect(document.querySelector(".campaign-game-over")).toBeTruthy();

    // 3. Campaign Game Over -> Main Menu
    const menuBtn = document.querySelector(".campaign-game-over button") as HTMLElement;
    menuBtn.click();
    expect(document.getElementById("screen-main-menu")?.style.display).toBe("flex");
    expect(currentCampaignState).toBeNull();
  });

  it("Journey 5: Session Restoration", async () => {
    // 1. Start custom mission setup
    document.getElementById("btn-menu-custom")?.click();
    expect(document.getElementById("screen-mission-setup")?.style.display).toBe("flex");

    // 2. Simulate "reload" by re-importing main.ts
    // ScreenManager saves state automatically to localStorage when screen changes.
    // Check if it's there
    expect(localStorage.getItem("voidlock_session_state")).toContain("mission-setup");

    // Re-import main.ts
    vi.resetModules();
    await import("@src/renderer/main");
    document.dispatchEvent(new Event("DOMContentLoaded"));

    // 3. Verify it restored to mission-setup
    expect(document.getElementById("screen-mission-setup")?.style.display).toBe("flex");
  });
});
