/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  GameState,
  MapGeneratorType,
  MissionType,
} from "@src/shared/types";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { GameApp } from "@src/renderer/app/GameApp";

// Mock dependencies
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

const mockGameClient = {
  init: vi.fn(), pause: vi.fn(), resume: vi.fn(),
  queryState: vi.fn(),
  onStateUpdate: vi.fn(),
  addStateUpdateListener: vi.fn(),
  removeStateUpdateListener: vi.fn(),
  stop: vi.fn(),
  getIsPaused: vi.fn().mockReturnValue(false),
  getTargetScale: vi.fn().mockReturnValue(1.0),
  setTimeScale: vi.fn(),
  getTimeScale: vi.fn().mockReturnValue(1.0),
  togglePause: vi.fn(),
  toggleDebugOverlay: vi.fn(),
  toggleLosOverlay: vi.fn(),
  getReplayData: vi.fn().mockReturnValue({}),
  applyCommand: vi.fn(),
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
    getWorldCoordinates: vi.fn().mockReturnValue({ x: 0, y: 0 }),
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
  prompt: vi.fn().mockResolvedValue(""),
};

vi.mock("@src/renderer/ui/ModalService", () => ({
  ModalService: vi.fn().mockImplementation(() => mockModalService),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

describe("Tutorial Mission 3: Sector Map", () => {
  let app: GameApp;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="screen-main-menu" style="display:none"></div>
      <div id="screen-campaign" style="display:none"></div>
      <div id="screen-equipment" style="display:none"></div>
      <div id="screen-mission-setup" style="display:none"></div>
      <div id="screen-debrief" style="display:none"></div>
      <div id="screen-mission" style="display:none"></div>
      <div id="screen-campaign-summary" style="display:none"></div>
      <div id="screen-statistics" style="display:none"></div>
      <div id="screen-engineering" style="display:none"></div>
      <div id="screen-settings" style="display:none"></div>
      <div id="screen-campaign-shell" style="display:none">
        <div id="campaign-shell-top-bar"></div>
        <div id="campaign-shell-content"></div>
        <div id="campaign-shell-footer"></div>
      </div>
      <div id="advisor-overlay" style="display:none"></div>
      <div id="menu-version"></div>
      <div id="squad-builder"></div>
    `;

    vi.clearAllMocks();
    CampaignManager.resetInstance();
    localStorage.removeItem("voidlock_tutorial_state");
    
    // Setup Campaign State for Mission 3 (after 2 missions completed)
    const mockCampaignState = {
      version: "1.0.0",
      saveVersion: 2,
      seed: 123,
      status: "Active",
      scrap: 700,
      intel: 20,
      currentSector: 2,
      currentNodeId: "node-2",
      nodes: [
        {
          id: "node-1",
          type: "Combat",
          status: "Cleared",
          rank: 0,
          difficulty: 1,
          mapSeed: 123,
          connections: ["node-2"],
          position: { x: 0, y: 0 },
          bonusLootCount: 0,
        },
        {
          id: "node-2",
          type: "Combat",
          status: "Cleared",
          rank: 1,
          difficulty: 1,
          mapSeed: 456,
          connections: ["node-3", "node-4"],
          position: { x: 10, y: 10 },
          bonusLootCount: 0,
        },
        {
          id: "node-3",
          type: "Combat",
          status: "Accessible",
          rank: 2,
          difficulty: 1.2,
          mapSeed: 789,
          connections: [],
          position: { x: 20, y: 20 },
          bonusLootCount: 0,
        },
        {
            id: "node-4",
            type: "Shop",
            status: "Accessible",
            rank: 2,
            difficulty: 1.0,
            mapSeed: 101,
            connections: [],
            position: { x: 20, y: 0 },
            bonusLootCount: 0,
          }
      ],
      roster: [
        {
          id: "s1",
          name: "Soldier 1",
          archetypeId: "assault",
          hp: 100,
          maxHp: 100,
          soldierAim: 80,
          xp: 300,
          level: 3,
          kills: 10,
          missions: 2,
          status: "Healthy",
          equipment: { rightHand: "pistol" },
        },
        {
            id: "s2",
            name: "Soldier 2",
            archetypeId: "assault",
            hp: 100,
            maxHp: 100,
            soldierAim: 80,
            xp: 150,
            level: 2,
            kills: 5,
            missions: 1,
            status: "Healthy",
            equipment: { rightHand: "pistol" },
          }
      ],
      history: [
        { 
          nodeId: "node-1", 
          seed: 123,
          result: "Won", 
          aliensKilled: 10,
          scrapGained: 100,
          intelGained: 5,
          timeSpent: 60000,
          soldierResults: [] 
        },
        { 
          nodeId: "node-2", 
          seed: 456,
          result: "Won", 
          aliensKilled: 15,
          scrapGained: 150,
          intelGained: 10,
          timeSpent: 75000,
          soldierResults: [] 
        }
      ],
      rules: {
        mode: "Preset",
        difficulty: "Standard",
        deathRule: "Iron",
        allowTacticalPause: true,
        mapGeneratorType: MapGeneratorType.DenseShip,
        difficultyScaling: 1.5,
        resourceScarcity: 0.7,
        startingScrap: 300,
        mapGrowthRate: 0.5,
        baseEnemyCount: 4,
        enemyGrowthPerMission: 1.5,
        economyMode: "Open",
        skipPrologue: false,
      },
      unlockedArchetypes: ["assault"],
      unlockedItems: ["pistol"],
    };

    const manager = CampaignManager.getInstance({
        load: vi.fn().mockReturnValue(mockCampaignState),
        save: vi.fn(),
        remove: vi.fn(),
        getSyncStatus: vi.fn().mockReturnValue("synced")
    } as any);
    (manager as any).state = mockCampaignState;

    // Set location hash to trigger redirection in NavigationOrchestrator
    window.location.hash = "#campaign";

    app = new GameApp();
    await app.initialize();
  });

  it("should start in Sector Map and show tutorial after Mission 2", async () => {
    app.start();

    // Verify Sector Map is shown
    const campaignScreen = document.getElementById("screen-campaign");
    expect(campaignScreen?.style.display).toBe("flex");

    // Verify all tabs are visible in CampaignShell
    const tabs = document.querySelectorAll(".shell-tab");
    expect(tabs.length).toBeGreaterThan(1);
    
    const tabLabels = Array.from(tabs).map(t => t.textContent);
    expect(tabLabels).toContain("Sector Map");
    expect(tabLabels).toContain("Ready Room");
    expect(tabLabels).toContain("Engineering");

    // Verify Advisor message for Sector Map was triggered
    const tutorialState = localStorage.getItem("voidlock_tutorial_state");
    expect(tutorialState).toContain("sector_map_intro");
  });

  it("should unlock Squad Selection on Equipment Screen in Mission 3", async () => {
    app.start();

    // 1. Select a node on the Sector Map
    const nodeEl = document.querySelector('.campaign-node.accessible') as HTMLElement;
    expect(nodeEl).not.toBeNull();
    nodeEl.click();

    // 2. Verify we are now on the Equipment Screen
    const equipmentScreen = document.getElementById("screen-equipment");
    expect(equipmentScreen?.style.display).toBe("flex");

    // 3. Verify Advisor message for Squad Selection was triggered
    const tutorialState = localStorage.getItem("voidlock_tutorial_state");
    expect(tutorialState).toContain("squad_selection_intro");

    // 4. Verify "Remove" button is PRESENT on soldier cards
    const removeBtns = equipmentScreen?.querySelectorAll(".remove-soldier-btn");
    expect(removeBtns?.length).toBeGreaterThan(0);

    // 5. Verify Slots are NOT disabled
    const slots = equipmentScreen?.querySelectorAll(".paper-doll-slot");
    slots?.forEach(slot => {
        expect(slot.classList.contains("disabled")).toBe(false);
    });

    // 6. Verify "Empty Slots" are interactive (not showing "Slot Restricted")
    const emptySlots = Array.from(equipmentScreen?.querySelectorAll(".menu-item") || [])
        .filter(el => el.textContent?.includes("[Empty Slot]"));
    
    // If there are 2 soldiers in roster and 4 slots, there should be 2 empty slots
    expect(emptySlots.length).toBeGreaterThan(0);
    emptySlots.forEach(slot => {
        expect(slot.textContent).not.toContain("Slot Restricted");
        expect(slot.textContent).toContain("Click to Add Soldier");
        expect(slot.classList.contains("disabled")).toBe(false);
    });
    
    // 7. Verify Store is NOT locked
    const lockedMsg = equipmentScreen?.querySelector(".locked-store-message");
    expect(lockedMsg).toBeNull();

    const suppliesHeader = Array.from(equipmentScreen?.querySelectorAll("h3") || [])
        .find(h => h.textContent === "Global Supplies");
    expect(suppliesHeader).not.toBeUndefined();
  });
});
