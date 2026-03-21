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
  (mockConstructor as any).getInstance = vi.fn().mockReturnValue(mockInstance);
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
  (mockConstructor as any).getInstance = vi.fn().mockReturnValue(mockInstance);
  return {
    AssetManager: mockConstructor,
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

// Mock CampaignManager
let mockCampaignState: any = null;

vi.mock("@src/renderer/campaign/CampaignManager", () => {
  const mockInstance = {
    getState: vi.fn(() => mockCampaignState),
    getStorage: vi.fn().mockReturnValue({
        getCloudSync: vi.fn().mockReturnValue({
            initialize: vi.fn().mockResolvedValue(undefined),
            setEnabled: vi.fn(),
        }),
        load: vi.fn(),
    }),
    getSyncStatus: vi.fn().mockReturnValue("local-only"),
    addChangeListener: vi.fn(),
    removeChangeListener: vi.fn(),
    load: vi.fn(),
    save: vi.fn(),
    assignEquipment: vi.fn(),
    processMissionResult: vi.fn(),
    startNewCampaign: vi.fn(),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  (mockConstructor as any).getInstance = vi.fn().mockReturnValue(mockInstance);
  return {
    CampaignManager: mockConstructor,
  };
});

describe("Tutorial Mission 2 Integration", () => {
  let app: GameApp;

  beforeEach(async () => {
    // Set state to Mission 2 (history.length === 1)
    mockCampaignState = {
      status: "Active",
      nodes: [
          { id: "n1", type: "Combat", status: "Accessible", rank: 0, difficulty: 1, mapSeed: 1, connections: [], position: {x:0, y:0}, bonusLootCount: 0 }
      ],
      roster: [
          { id: "s1", name: "Soldier 1", archetypeId: "scout", status: "Healthy", level: 1, hp: 100, maxHp: 100, xp: 0, kills: 0, missions: 1, recoveryTime: 0, soldierAim: 80, equipment: { rightHand: "pistol", leftHand: undefined, body: undefined, feet: undefined } }
      ],
      scrap: 100,
      intel: 0,
      currentSector: 1,
      currentNodeId: null,
      history: [{}], // One mission completed
      unlockedArchetypes: ["scout"],
      rules: {
        mode: "Preset",
        difficulty: "Standard",
        allowTacticalPause: true,
        mapGeneratorType: "DenseShip",
      },
    };

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

  it("should enforce lockdown and show only Asset Management Hub during Mission 2 tutorial", async () => {
    // 1. Enter campaign
    document.getElementById("btn-menu-campaign")?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const shellContainer = document.getElementById("screen-campaign-shell")!;
    const tabs = Array.from(shellContainer.querySelectorAll(".tab-button"));
    
    // In Mission 2 tutorial, only one tab is shown
    expect(tabs.length).toBe(1);
    expect(tabs[0].textContent).toBe("Asset Management Hub");

    const equipmentScreen = document.getElementById("screen-equipment");
    expect(equipmentScreen?.style.display).toBe("flex");

    // Verify slots are disabled (lockdown)
    const slots = equipmentScreen?.querySelectorAll(".paper-doll-slot");
    expect(slots?.length).toBeGreaterThan(0);
    slots?.forEach(slot => {
        expect(slot.classList.contains("disabled")).toBe(true);
    });
  });

  it("should pre-fill squad with roster soldiers during Mission 2 tutorial", async () => {
    // 1. Enter campaign
    document.getElementById("btn-menu-campaign")?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const equipmentScreen = document.getElementById("screen-equipment");
    
    // Verify that the first soldier slot is pre-filled with "Soldier 1"
    const soldierItems = equipmentScreen?.querySelectorAll(".soldier-item");
    expect(soldierItems?.length).toBeGreaterThan(0);
    expect(soldierItems?.[0].textContent).toContain("Soldier 1");
  });
});
