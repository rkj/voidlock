/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing main.ts
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" }
}));

// We need a way to trigger the GameClient callbacks
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
  getReplayData: vi.fn().mockReturnValue({}),
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
const mockCampaignState = {
  status: "Active",
  nodes: [{ id: "node-1", type: "Combat", status: "Accessible", difficulty: 1, mapSeed: 123, connections: [], position: { x: 0, y: 0 } }],
  roster: [
    { id: "s1", name: "Soldier 1", archetypeId: "scout", status: "Healthy", level: 1, hp: 100, maxHp: 100, xp: 0, soldierAim: 80, equipment: { rightHand: "pulse_rifle", leftHand: null, body: "basic_armor", feet: null } }
  ],
  scrap: 0,
  intel: 0,
  currentSector: 1,
  currentNodeId: null,
  history: [],
  unlockedArchetypes: ["scout", "heavy", "medic", "demolition"],
  rules: { allowTacticalPause: true, themeId: "default", mode: "Preset", difficulty: "Standard", deathRule: "Simulation", difficultyScaling: 1, resourceScarcity: 1 }
};

vi.mock("@src/renderer/campaign/CampaignManager", () => {
  return {
    CampaignManager: {
      getInstance: vi.fn().mockReturnValue({
        getState: vi.fn(() => mockCampaignState),
        load: vi.fn(),
        processMissionResult: vi.fn(),
        save: vi.fn(),
        startNewCampaign: vi.fn(),
        reset: vi.fn(),
        deleteSave: vi.fn(),
      }),
    },
  };
});

describe("Screen Flow Integration", () => {
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

  it("should follow Flow 1: MainMenu -> Campaign -> Mission Setup -> Mission -> Win -> Debrief -> Campaign", async () => {
    // 1. Main Menu -> Campaign
    const btnCampaign = document.getElementById("btn-menu-campaign");
    btnCampaign?.click();
    expect(document.getElementById("screen-campaign")?.style.display).toBe("flex");

    // 2. Campaign -> Mission Setup
    // CampaignScreen renders nodes as .campaign-node
    const nodes = document.querySelectorAll(".campaign-node");
    expect(nodes.length).toBeGreaterThan(0);
    (nodes[0] as HTMLElement).click();
    
    expect(document.getElementById("screen-mission-setup")?.style.display).toBe("flex");

    // 3. Mission Setup -> Equipment
    const btnGotoEquipment = document.getElementById("btn-goto-equipment") as HTMLButtonElement;
    // In campaign mode, squad builder has checkboxes
    const checkboxes = document.querySelectorAll("#squad-builder input[type='checkbox']");
    checkboxes.forEach(cb => {
      if (!(cb as HTMLInputElement).checked) {
        (cb as HTMLInputElement).click();
      }
    });
    
    btnGotoEquipment.click();
    expect(document.getElementById("screen-equipment")?.style.display).toBe("flex");

    // 4. Equipment -> Mission
    const allButtons = document.querySelectorAll("#screen-equipment button");
    const equipmentLaunchBtn = Array.from(allButtons).find(b => b.textContent?.includes("CONFIRM")) as HTMLElement;
    expect(equipmentLaunchBtn).toBeDefined();
    equipmentLaunchBtn?.click();

    expect(document.getElementById("screen-mission")?.style.display).toBe("flex");

    // 5. Mission -> Win
    expect(stateUpdateCallback).not.toBeNull();
    stateUpdateCallback!({
      status: "Won",
      t: 10,
      stats: { aliensKilled: 5, scrapGained: 100, threatLevel: 0 },
      units: [{ id: "s1", hp: 100, maxHp: 100, kills: 2, state: 0, pos: { x: 0, y: 0 }, stats: { speed: 20 } }],
      objectives: [],
      settings: { debugOverlayEnabled: false, timeScale: 1.0, isPaused: false },
      map: { width: 10, height: 10, cells: [] },
      enemies: [],
      visibleCells: [],
      discoveredCells: [],
      loot: [],
    });

    expect(document.getElementById("screen-debrief")?.style.display).toBe("flex");

    // 6. Debrief -> Campaign
    const continueBtn = Array.from(document.querySelectorAll("#screen-debrief button")).find(b => b.textContent?.includes("RETURN")) as HTMLElement;
    continueBtn?.click();

    expect(document.getElementById("screen-campaign")?.style.display).toBe("flex");
  });

  it("should follow Flow 2: MainMenu -> Mission Setup -> Mission -> Lose -> Debrief -> Main Menu", async () => {
    // 1. Main Menu -> Mission Setup
    const btnCustom = document.getElementById("btn-menu-custom");
    btnCustom?.click();
    expect(document.getElementById("screen-mission-setup")?.style.display).toBe("flex");

    // 2. Mission Setup -> Mission
    // Select a soldier (scout)
    const scoutInput = Array.from(document.querySelectorAll("#squad-builder div")).find(d => d.textContent?.includes("Scout"))?.querySelector("input");
    if (scoutInput) {
      scoutInput.value = "1";
      scoutInput.dispatchEvent(new Event("change"));
    }

    const btnGotoEquipment = document.getElementById("btn-goto-equipment") as HTMLButtonElement;
    btnGotoEquipment.click();
    
    const allButtons = document.querySelectorAll("#screen-equipment button");
    const equipmentLaunchBtn = Array.from(allButtons).find(b => b.textContent?.includes("CONFIRM")) as HTMLElement;
    equipmentLaunchBtn?.click();

    expect(document.getElementById("screen-mission")?.style.display).toBe("flex");

    // 3. Mission -> Lose
    expect(stateUpdateCallback).not.toBeNull();
    stateUpdateCallback!({
      status: "Lost",
      t: 20,
      stats: { aliensKilled: 1, scrapGained: 10, threatLevel: 50 },
      units: [{ id: "s1", hp: 0, maxHp: 100, kills: 0, state: 2, pos: { x: 0, y: 0 }, stats: { speed: 20 } }], // Dead
      objectives: [],
      settings: { debugOverlayEnabled: false, timeScale: 1.0, isPaused: false },
      map: { width: 10, height: 10, cells: [] },
      enemies: [],
      visibleCells: [],
      discoveredCells: [],
      loot: [],
    });

    expect(document.getElementById("screen-debrief")?.style.display).toBe("flex");

    // 4. Debrief -> Main Menu
    const continueBtn = Array.from(document.querySelectorAll("#screen-debrief button")).find(b => b.textContent?.includes("RETURN")) as HTMLElement;
    continueBtn?.click();

    expect(document.getElementById("screen-main-menu")?.style.display).toBe("flex");
  });
});
