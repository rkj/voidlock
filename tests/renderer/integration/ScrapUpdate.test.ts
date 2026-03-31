/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameApp } from "@src/renderer/app/GameApp";

// Mock dependencies
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

vi.mock("@src/engine/GameClient", () => ({
  GameClient: vi.fn().mockImplementation(() => ({
    onStateUpdate: vi.fn(),
    queryState: vi.fn(),
    addStateUpdateListener: vi.fn(),
    removeStateUpdateListener: vi.fn(),
    init: vi.fn(), pause: vi.fn(), resume: vi.fn(),
    stop: vi.fn(),
    freezeForDialog: vi.fn(), unfreezeFromDialog: vi.fn(),
    getIsPaused: vi.fn().mockReturnValue(false),
    getTargetScale: vi.fn().mockReturnValue(1.0),
    setTimeScale: vi.fn(),
    getTimeScale: vi.fn().mockReturnValue(1.0),
  })),
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

vi.mock("@src/renderer/visuals/AssetManager", () => {
  const mockInstance = {
    loadSprites: vi.fn(),
    getUnitSprite: vi.fn(),
    getEnemySprite: vi.fn(),
    getMiscSprite: vi.fn(),
    getIcon: vi.fn(),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  
  return {
    AssetManager: mockConstructor,
  };
});

const mockModalService = {
  alert: vi.fn().mockResolvedValue(undefined),
  confirm: vi.fn().mockResolvedValue(true),
  prompt: vi.fn().mockResolvedValue("New Recruit"),
  show: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@src/renderer/ui/ModalService", () => ({
  ModalService: vi.fn().mockImplementation(() => mockModalService),
}));

// Mock CampaignManager
let mockCampaignState: any = null;
let changeListeners: Set<() => void> = new Set();

vi.mock("@src/renderer/campaign/CampaignManager", () => {
  const mockInstance = {
    getState: vi.fn(() => mockCampaignState),
    selectNode: vi.fn(),
    getStorage: vi.fn().mockReturnValue({
        getCloudSync: vi.fn().mockReturnValue({
            initialize: vi.fn().mockResolvedValue(undefined),
            setEnabled: vi.fn(),
        }),
        load: vi.fn(),
    }),
    getSyncStatus: vi.fn().mockReturnValue("local-only"),
    addChangeListener: vi.fn((l) => changeListeners.add(l)),
    removeChangeListener: vi.fn((l) => changeListeners.delete(l)),
    load: vi.fn(),
    save: vi.fn(),
    assignEquipment: vi.fn(),
    reconcileMission: vi.fn(),
    recruitSoldier: vi.fn((archetypeId) => {
        if (mockCampaignState) {
            mockCampaignState.scrap -= 100;
            mockCampaignState.roster.push({
                id: "new-s",
                name: "Recruit",
                archetypeId,
                status: "Healthy",
                level: 1,
                hp: 100,
                maxHp: 100,
                xp: 0,
                kills: 0,
                missions: 0,
                recoveryTime: 0,
                soldierAim: 80,
                equipment: { rightHand: "pistol", leftHand: undefined, body: undefined, feet: undefined }
            });
            changeListeners.forEach(l => l());
        }
        return "new-s";
    }),
    startNewCampaign: vi.fn(),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  
  return {
    CampaignManager: mockConstructor,
  };
});

describe("Scrap Update Integration", () => {
  let app: GameApp;

  beforeEach(async () => {
    mockCampaignState = {
      status: "Active",
      nodes: [
          { id: "n1", type: "Combat", status: "Accessible", rank: 0, difficulty: 1, mapSeed: 1, connections: [], position: {x:0, y:0}, bonusLootCount: 0 }
      ],
      roster: [],
      scrap: 1000,
      intel: 0,
      currentSector: 1,
      currentNodeId: null,
      history: [],
      unlockedArchetypes: ["scout", "heavy", "medic", "demolition"],
      rules: {
        mode: "Preset",
        difficulty: "Standard",
        allowTacticalPause: true,
        mapGeneratorType: "DenseShip",
      },
    };
    changeListeners.clear();
    vi.clearAllMocks();

    // Mock ResizeObserver
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    document.body.innerHTML = `
      <div id="app">
        <div id="screen-main-menu" class="screen">
          <button id="btn-menu-campaign">Campaign</button>
        </div>
        <div id="screen-campaign-shell" style="display:none">
            <div id="campaign-shell-content">
                <div id="screen-campaign" class="screen" style="display:none"></div>
                <div id="screen-equipment" style="display:none"></div>
                <div id="screen-statistics" style="display:none"></div>
                <div id="screen-engineering" style="display:none"></div>
                <div id="screen-settings" style="display:none"></div>
            </div>
            <div id="campaign-shell-top-bar"></div>
            <div id="campaign-shell-footer"></div>
        </div>
        <div id="screen-mission-setup" style="display:none"></div>
        <div id="screen-mission" style="display:none"></div>
        <div id="screen-debrief" style="display:none"></div>
        <div id="screen-campaign-summary" style="display:none"></div>
        <div id="keyboard-help-overlay" style="display:none"></div>
        <div id="squad-builder" style="display:none"></div>
      </div>
    `;

    vi.resetModules();
    const { bootstrap } = await import("@src/renderer/main");
    app = await bootstrap();
    document.dispatchEvent(new Event("DOMContentLoaded"));
  });

  it("should update displayed scrap when recruiting a soldier", async () => {
    // 1. Enter campaign
    document.getElementById("btn-menu-campaign")?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 2. Verify initial scrap in top bar
    const topBar = document.getElementById("campaign-shell-top-bar");
    expect(topBar?.textContent).toContain("1000");

    // 3. Navigate to Equipment
    const shell = (app as any).registry.campaignShell;
    shell.onTabChange("ready-room");
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 4. Click Recruit button
    const allButtons = Array.from(document.querySelectorAll("button"));
    const recruitBtn = allButtons.find(b => b.textContent?.includes("Acquire New Asset")) as HTMLElement;
    if (!recruitBtn) {
        console.log("Available buttons:", allButtons.map(b => b.textContent));
    }
    expect(recruitBtn).toBeTruthy();
    recruitBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 5. Select an archetype to recruit (in center panel)
    const cards = Array.from(document.querySelectorAll(".soldier-card"));
    if (cards.length === 0) {
        console.log("No archetype cards found. All buttons:", Array.from(document.querySelectorAll("button")).map(b => b.textContent));
    }
    const scoutBtn = cards.find(b => b.textContent?.includes("Scout")) as HTMLElement;
    expect(scoutBtn).toBeTruthy();
    scoutBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 6. Verify scrap update in UI
    expect(topBar?.textContent).toContain("900");
  });
});
