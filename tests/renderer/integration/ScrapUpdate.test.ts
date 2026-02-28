/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { GameApp } from "@src/renderer/app/GameApp";

// Hoisted state
const { mockState } = vi.hoisted(() => ({
  mockState: { value: null as any }
}));

// Mock dependencies
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

const mockGameClient = {
  init: vi.fn(),
  onStateUpdate: vi.fn(),
  queryState: vi.fn(),
  stop: vi.fn(),
  addStateUpdateListener: vi.fn(),
  removeStateUpdateListener: vi.fn(),
  toggleDebugOverlay: vi.fn(),
  toggleLosOverlay: vi.fn(),
};

vi.mock("@src/engine/GameClient", () => ({
  GameClient: vi.fn().mockImplementation(() => mockGameClient),
}));

vi.mock("@src/renderer/Renderer", () => ({
  Renderer: vi.fn().mockImplementation(() => ({
    render: vi.fn(),
      destroy: vi.fn(),
    setCellSize: vi.fn(),
  })),
}));

vi.mock("@src/renderer/ThemeManager", () => ({
  ThemeManager: {
    getInstance: vi.fn().mockReturnValue({
      init: vi.fn().mockResolvedValue(undefined),
      setTheme: vi.fn(),
      getAssetUrl: vi.fn().mockReturnValue("mock-url"),
      getColor: vi.fn().mockReturnValue("#000"),
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

// Mock AssetManager
vi.mock("@src/renderer/visuals/AssetManager", () => ({
    AssetManager: {
        getInstance: vi.fn().mockReturnValue({
            loadSprites: vi.fn(),
            getSprite: vi.fn(),
        })
    }
}));

// Mock CampaignManager
vi.mock("@src/renderer/campaign/CampaignManager", () => {
  return {
    CampaignManager: {
      getInstance: vi.fn().mockReturnValue({
        getState: vi.fn(() => mockState.value),
        getStorage: vi.fn().mockReturnValue({
            getCloudSync: vi.fn().mockReturnValue({
                initialize: vi.fn().mockResolvedValue(undefined),
                setEnabled: vi.fn(),
            }),
            load: vi.fn(),
        }),
        getSyncStatus: vi.fn().mockReturnValue("local-only"),
        load: vi.fn().mockResolvedValue(true),
        save: vi.fn(),
        startNewCampaign: vi.fn((seed, diff, pause, theme) => {
          mockState.value = {
            status: "Active",
            nodes: [
                { 
                    id: "node1", 
                    type: "Combat", 
                    status: "Accessible", 
                    mapSeed: 123, 
                    connections: [], 
                    position: {x:0, y:0},
                    difficulty: 1,
                    rank: 1 
                }
            ],
            roster: [], // Empty roster to force recruitment
            scrap: 1000,
            intel: 0,
            currentSector: 1,
            currentNodeId: "node1",
            unlockedArchetypes: ["scout"],
            unlockedItems: [],
            rules: {
                allowTacticalPause: true,
                difficulty: "Clone",
                mapGeneratorType: "DenseShip",
            }
          };
        }),
        recruitSoldier: vi.fn(function(this: any, archId: string) {
             // Simulate spending scrap for recruit
             if (mockState.value) {
                 mockState.value.scrap -= 100;
                 mockState.value.roster.push({
                     id: "s" + Date.now(),
                     name: "Rookie",
                     archetypeId: "scout",
                     status: "Healthy",
                     hp: 100,
                     maxHp: 100,
                     equipment: {}
                 });
                 this.notifyListeners();
             }
             return "s" + Date.now();
        }),
        spendScrap: vi.fn(function(this: any, amount: number) {
            if (mockState.value) {
                mockState.value.scrap -= amount;
                this.notifyListeners();
            }
        }),
        listeners: new Set<() => void>(),
        addChangeListener: vi.fn(function(this: any, l: () => void) {
            this.listeners.add(l);
        }), 
        removeChangeListener: vi.fn(function(this: any, l: () => void) {
            this.listeners.delete(l);
        }),
        notifyListeners: function(this: any) {
            this.listeners.forEach((l: () => void) => l());
        },
        getAvailableNodes: vi.fn(() => mockState.value?.nodes || []),
      }),
    },
  };
});


describe("Scrap Update Integration", () => {
  let app: GameApp;

  beforeEach(async () => {
    mockState.value = null;
    vi.clearAllMocks();

    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn(),
    }) as any;

    document.body.innerHTML = `
      <div id="game-container"></div>
      <div id="screen-main-menu">
          <button id="btn-menu-campaign">Campaign</button>
      </div>
      <div id="screen-campaign-shell" style="display:none"></div>
      <div id="screen-equipment" style="display:none"></div>
      <div id="screen-mission-setup" style="display:none"></div>
      <div id="screen-campaign" style="display:none"></div>
      <div id="screen-engineering" style="display:none"></div>
      <div id="screen-statistics" style="display:none"></div>
      <div id="screen-settings" style="display:none"></div>
      <div id="screen-debrief" style="display:none"></div>
      <div id="screen-campaign-summary" style="display:none"></div>
      <div id="screen-mission" style="display:none">
         <canvas id="game-canvas"></canvas>
      </div>
      <div id="squad-builder"></div>
    `;

    // Initialize App
    const { GameApp } = await import("@src/renderer/app/GameApp");
    app = new GameApp();
    await app.initialize();
  });

  it("should update displayed scrap when recruiting a soldier", async () => {
    const manager = CampaignManager.getInstance();
    
    // 1. Manually set up campaign state
    manager.startNewCampaign("seed", "Clone", true, "Default");
    
    // 2. Mock state is now set with 1000 scrap
    expect(manager.getState()?.scrap).toBe(1000);
    
    // 3. Force GameApp to enter campaign mode
    (app as any).registry.navigationOrchestrator.handleExternalScreenChange("campaign", true);
    
    // 4. Verify initial render of CampaignShell
    const shell = document.getElementById("screen-campaign-shell");
    const topBar = shell?.querySelector("#campaign-shell-top-bar");
    expect(topBar?.innerHTML).toContain("1000");

    // 5. Navigate to Equipment Screen via "Ready Room" tab
    const readyRoomTab = Array.from(document.querySelectorAll(".tab-button")).find(b => b.textContent === "Ready Room") as HTMLElement;
    expect(readyRoomTab).toBeTruthy();
    readyRoomTab.click();
    
    const eqScreen = document.getElementById("screen-equipment");
    expect(eqScreen?.style.display).not.toBe("none");

    // 6. Find Recruit button/item. 
    await new Promise(resolve => setTimeout(resolve, 0));
    
    const emptySlot = document.querySelector(".menu-item.clickable");
    if (!emptySlot) throw new Error("No empty slot found");
    (emptySlot as HTMLElement).click();
    
    // Now the center panel should show "Recruit New Soldier" large button
    const recruitLarge = document.querySelector("[data-focus-id='recruit-btn-large']");
    if (!recruitLarge) throw new Error("No large recruit button found");
    (recruitLarge as HTMLElement).click();
    
    // Now the right panel should show archetypes (e.g., recruit-scout)
    await new Promise(resolve => setTimeout(resolve, 0));

    const recruitItem = document.querySelector("[data-focus-id^='recruit-']:not(.recruit-btn-large)");
    if (!recruitItem) {
        console.log("DOM during failure:", document.body.innerHTML);
        throw new Error("No recruit archetype found");
    }
    console.log("Found recruit item:", recruitItem.getAttribute("data-focus-id"));
    
    // 7. Click to recruit
    (recruitItem as HTMLElement).click();
    
    // 8. Verify scrap update in manager
    expect(manager.recruitSoldier).toHaveBeenCalled();
    expect(manager.getState()?.scrap).toBe(900); // 1000 - 100
    
    // 9. Verify UI update
    // The shell top bar should now say 900
    // THIS IS EXPECTED TO FAIL
    expect(topBar?.innerHTML).toContain("900");
  });
});
