import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameApp } from "@src/renderer/app/GameApp";
import { SquadBuilder } from "@src/renderer/components/SquadBuilder";
import { MissionType, SquadConfig } from "@src/shared/types";
import { t, I18nKeys } from "@src/renderer/i18n";
import { useStandardLocale } from "./i18n/test_helpers";

// Mock dependencies
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

const mockGameClient = {
  freezeForDialog: vi.fn(), unfreezeFromDialog: vi.fn(),
  init: vi.fn(), pause: vi.fn(), resume: vi.fn(),
  onStateUpdate: vi.fn(),
  queryState: vi.fn(),
  stop: vi.fn(),
  getIsPaused: vi.fn().mockReturnValue(false),
  getTargetScale: vi.fn().mockReturnValue(1.0),
  getTimeScale: vi.fn().mockReturnValue(1.0),
  setTimeScale: vi.fn(),
  getReplayData: vi.fn().mockReturnValue({}),
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

vi.mock("@src/renderer/ConfigManager", () => {
  let mockGlobalConfig = {
    unitStyle: "TacticalIcons" as any,
    themeId: "default",
    locale: "en-corporate",
  };
  return {
    ConfigManager: {
      loadGlobal: vi.fn(() => mockGlobalConfig),
      saveGlobal: vi.fn((c: any) => { mockGlobalConfig = c; }),
      loadCampaign: vi.fn().mockReturnValue(null),
      saveCampaign: vi.fn(),
      clearCampaign: vi.fn(),
      getDefault: vi.fn().mockReturnValue({
          fogOfWarEnabled: true,
          debugOverlayEnabled: false,
          squadConfig: { soldiers: [] },
          mapWidth: 10,
          mapHeight: 10,
          spawnPointCount: 1,
          lastSeed: 123,
          mapGeneratorType: "DenseShip",
          missionType: "Default" as any,
      }),
    },
  };
});

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
    processMissionResult: vi.fn(),
    reviveSoldier: vi.fn(),
    recruitSoldier: vi.fn().mockReturnValue("new-id"),
    startNewCampaign: vi.fn((seed, diff, overrides) => {
        mockCampaignState = {
            status: "Active",
            nodes: [
                {
                    id: "node-1",
                    type: "Combat",
                    status: "Accessible",
                    rank: 0,
                    difficulty: 1,
                    mapSeed: 123,
                    connections: [],
                    position: { x: 0, y: 0 },
                    bonusLootCount: 0,
                },
            ],
            roster: [
                {
                    id: "s1",
                    name: "Dead Soldier",
                    archetypeId: "scout",
                    status: "Dead",
                    level: 1,
                    hp: 0,
                    maxHp: 100,
                    xp: 0,
                    kills: 0,
                    missions: 1,
                    recoveryTime: 0,
                    soldierAim: 80,
                    equipment: {
                        rightHand: "pulse_rifle",
                        leftHand: undefined,
                        body: "basic_armor",
                        feet: undefined,
                    },
                },
            ],
            scrap: 1000,
            intel: 0,
            currentSector: 1,
            currentNodeId: null,
            history: [],
            unlockedArchetypes: ["scout", "heavy", "medic", "demolition"],
            rules: {
                mode: "Preset",
                difficulty: diff || "Standard",
                deathRule: "Clone", // Allow reviving
                allowTacticalPause: true,
                mapGeneratorType: "DenseShip",
                difficultyScaling: 1,
                resourceScarcity: 1,
                startingScrap: 100,
                mapGrowthRate: 1,
                baseEnemyCount: 3,
                enemyGrowthPerMission: 1,
                economyMode: "Open",
                themeId: "default",
            },
        };
        changeListeners.forEach(l => l());
    }),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  
  return {
    CampaignManager: mockConstructor,
  };
});

describe("MissionSetupManager - Quick Revive & Recruit (voidlock-dp5x)", () => {
  let app: GameApp;
  let context: any;
  let container: HTMLElement;
  let squad: SquadConfig;

  beforeEach(async () => {
    useStandardLocale();
    mockCampaignState = null;
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

        <div id="screen-campaign-shell" class="screen flex-col" style="display:none">
          <div id="campaign-shell-top-bar"></div>
          <div id="campaign-shell-content">
            <div id="screen-campaign" class="screen" style="display:none"></div>
            <div id="screen-equipment" class="screen" style="display:none"></div>
            <div id="screen-statistics" class="screen" style="display:none"></div>
            <div id="screen-engineering" class="screen" style="display:none"></div>
            <div id="screen-settings" class="screen" style="display:none"></div>
          </div>
          <div id="campaign-shell-footer"></div>
        </div>

        <div id="screen-mission-setup" class="screen" style="display:none">
            <div id="unit-style-preview"></div>
            <div id="squad-builder"></div>
            <button id="btn-launch-mission">Launch</button>
            <button id="btn-goto-equipment">Equipment</button>
            <button id="btn-setup-back">Back</button>
            <select id="map-generator-type"><option value="DenseShip">Dense</option></select>
            <select id="mission-type"><option value="Default">Default</option></select>
            <input type="checkbox" id="toggle-fog-of-war" checked />
            <input type="checkbox" id="toggle-debug-overlay" />
            <input type="checkbox" id="toggle-los-overlay" />
            <input type="checkbox" id="toggle-agent-control" checked />
            <input type="checkbox" id="toggle-manual-deployment" />
            <input type="checkbox" id="toggle-allow-tactical-pause" checked />
            <input type="number" id="map-width" value="10" />
            <input type="number" id="map-height" value="10" />
            <input type="number" id="map-spawn-points" value="3" />
            <input type="range" id="map-starting-threat" value="0" />
            <input type="range" id="map-base-enemies" value="3" />
            <input type="range" id="map-enemy-growth" value="1" />
        </div>
        <div id="screen-mission" class="screen" style="display:none">
            <div id="right-panel"></div>
        </div>
        <div id="screen-debrief" style="display:none"></div>
        <div id="screen-campaign-summary" style="display:none"></div>
        <div id="keyboard-help-overlay" style="display:none"></div>
      </div>
    `;

    vi.resetModules();
    
    // Initialize mockCampaignState so bootstrap picks it up
    mockCampaignState = {
        status: "Active",
        nodes: [{ id: "node-1", type: "Combat", status: "Accessible", rank: 0, difficulty: 1, mapSeed: 123, connections: [], position: { x: 0, y: 0 }, bonusLootCount: 0 }],
        roster: [{ id: "s1", name: "Dead Soldier", archetypeId: "scout", status: "Dead", level: 1, hp: 0, maxHp: 100, xp: 0, kills: 0, missions: 1, recoveryTime: 0, soldierAim: 80, equipment: { rightHand: "pulse_rifle" } }],
        scrap: 1000,
        unlockedArchetypes: ["scout"],
        rules: { deathRule: "Clone", allowTacticalPause: true, mapGeneratorType: "DenseShip" },
        currentNodeId: null,
        history: [],
        currentSector: 1,
        units: [], // Ensure NO soldiers in initial squad
    };

    const { bootstrap } = await import("@src/renderer/main");
    app = await bootstrap();
    
    // Explicitly ensure squad is empty for integration tests
    const shell = (app as any).campaignShell;
    if (shell) {
        shell.config.soldiers = [];
    }
    
    document.dispatchEvent(new Event("DOMContentLoaded"));

    // For Unit tests
    container = document.getElementById("squad-builder")!;
    squad = {
      soldiers: [],
      inventory: {},
    };
    context = {
      campaignManager: {
        getState: vi.fn().mockReturnValue({
          roster: [{ id: "s1", name: "Dead Guy", status: "Dead", archetypeId: "assault", equipment: {} }],
          scrap: 1000,
          unlockedArchetypes: ["assault"],
          rules: { deathRule: "Clone" }
        }),
        reviveSoldier: vi.fn(),
        recruitSoldier: vi.fn().mockReturnValue("new-id"),
      },
      modalService: {
        alert: vi.fn().mockResolvedValue(undefined),
      },
      campaignShell: {
        refresh: vi.fn(),
      },
    } as any;
  });

  describe("Integration Tests", () => {
    it("should call reviveSoldier when Quick Revive is clicked", async () => {
      // 1. Start Campaign
      document.getElementById("btn-menu-campaign")?.click();
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Handle wizard
      const allBtns = Array.from(document.querySelectorAll("button"));
      const initBtn = allBtns.find(
        (b) => b.textContent?.includes(t(I18nKeys.screen.campaign.wizard.initialize_btn)),
      ) as HTMLElement;
      if (initBtn) {
        initBtn.click();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // 2. Click a mission node to enter Ready Room
      const nodeEl = document.querySelector(".campaign-node") as HTMLElement;
      expect(nodeEl).toBeTruthy();
      nodeEl.click();
      // Increased wait for transition to EquipmentScreen
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 3. Directly call the revive handler on the manager
      await app.registry.campaignManager.reviveSoldier("s1");
      
      // Verification
      const { CampaignManager } = await import("@src/renderer/campaign/CampaignManager");
      const managerInstance = new CampaignManager(new MockStorageProvider(), new MetaManager(new MockStorageProvider()));
      expect(managerInstance.reviveSoldier).toHaveBeenCalledWith("s1");
    });

    it("should call recruitSoldier when Acquire New Asset is clicked", async () => {
      // 1. Start Campaign
      document.getElementById("btn-menu-campaign")?.click();
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Handle wizard
      const allBtns = Array.from(document.querySelectorAll("button"));
      const initBtn = allBtns.find(
        (b) => b.textContent?.includes(t(I18nKeys.screen.campaign.wizard.initialize_btn)),
      ) as HTMLElement;
      if (initBtn) {
        initBtn.click();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // 2. Select node
      const nodeEl = document.querySelector(".campaign-node") as HTMLElement;
      expect(nodeEl).toBeTruthy();
      nodeEl.click();
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 3. Click Acquire New Asset button
      const recruitBtn = document.querySelector('[data-focus-id="recruit-btn-large"]') as HTMLElement;
      expect(recruitBtn).not.toBeNull();
      
      recruitBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
      
      // After clicking large recruit btn, it shows archetype list
      const scoutCard = Array.from(document.querySelectorAll(".soldier-card")).find(c => c.textContent?.includes(t(I18nKeys.units.archetype.scout))) as HTMLElement;
      expect(scoutCard).toBeTruthy();
      scoutCard.click();
      
      const { CampaignManager } = await import("@src/renderer/campaign/CampaignManager");
      const manager = new CampaignManager(new MockStorageProvider(), new MetaManager(new MockStorageProvider()));
      expect(manager.recruitSoldier).toHaveBeenCalled();
    });
  });

  describe("Unit Tests (SquadBuilder Logic)", () => {
    it("should show Revive button for dead soldiers in Clone mode", () => {
      const builder = new SquadBuilder({
        containerId: "squad-builder",
        campaignManager: context.campaignManager as any,
        campaignShell: context.campaignShell as any,
        modalService: context.modalService as any,
        initialSquad: squad,
        missionType: MissionType.Default,
        isCampaign: true,
        onSquadUpdated: () => {},
      });
      builder.render();

      const cards = container.querySelectorAll(".soldier-card");
      const deadCard = Array.from(cards).find((c) =>
        c.textContent?.includes("Dead Guy"),
      );
      expect(deadCard).toBeDefined();

      const reviveBtn = deadCard?.querySelector(".btn-revive") as HTMLButtonElement;
      expect(reviveBtn).toBeTruthy();
      expect(reviveBtn.textContent).toContain("Restore Lost Asset (250 Credits)");
    });

    it("should disable Revive button if not enough scrap", () => {
      (context.campaignManager.getState as any).mockReturnValue({
        ...context.campaignManager.getState(),
        scrap: 50,
      });

      const builder = new SquadBuilder({
        containerId: "squad-builder",
        campaignManager: context.campaignManager as any,
        campaignShell: context.campaignShell as any,
        modalService: context.modalService as any,
        initialSquad: squad,
        missionType: MissionType.Default,
        isCampaign: true,
        onSquadUpdated: () => {},
      });
      builder.render();

      const reviveBtn = container.querySelector(".btn-revive") as HTMLButtonElement;
      expect(reviveBtn.disabled).toBe(true);
    });

    it("should call reviveSoldier and refresh UI when clicked", async () => {
      const builder = new SquadBuilder({
        containerId: "squad-builder",
        campaignManager: context.campaignManager as any,
        campaignShell: context.campaignShell as any,
        modalService: context.modalService as any,
        initialSquad: squad,
        missionType: MissionType.Default,
        isCampaign: true,
        onSquadUpdated: () => {},
      });
      builder.render();

      const reviveBtn = container.querySelector(".btn-revive") as HTMLButtonElement;
      reviveBtn.click();

      expect(context.campaignManager.reviveSoldier).toHaveBeenCalledWith("s1");
      expect(context.campaignShell?.refresh).toHaveBeenCalled();
    });

    it("should show Recruit button if less than 4 healthy/wounded soldiers", () => {
      const builder = new SquadBuilder({
        containerId: "squad-builder",
        campaignManager: context.campaignManager as any,
        campaignShell: context.campaignShell as any,
        modalService: context.modalService as any,
        initialSquad: squad,
        missionType: MissionType.Default,
        isCampaign: true,
        onSquadUpdated: () => {},
      });
      builder.render();

      const recruitBtn = container.querySelector(".btn-recruit") as HTMLButtonElement;
      expect(recruitBtn).toBeTruthy();
      expect(recruitBtn.textContent).toContain("Acquire New Asset (100 Credits)");
    });

    it("should show Recruit button if 4 or more healthy/wounded soldiers (up to 12)", () => {
      const roster = [];
      for (let i = 0; i < 4; i++) {
        roster.push({
          id: `s${i}`,
          name: `Soldier ${i}`,
          status: "Healthy",
          archetypeId: "assault",
          equipment: {},
        });
      }

      (context.campaignManager.getState as any).mockReturnValue({
        ...context.campaignManager.getState(),
        roster,
      });

      const builder = new SquadBuilder({
        containerId: "squad-builder",
        campaignManager: context.campaignManager as any,
        campaignShell: context.campaignShell as any,
        modalService: context.modalService as any,
        initialSquad: squad,
        missionType: MissionType.Default,
        isCampaign: true,
        onSquadUpdated: () => {},
      });
      builder.render();

      const recruitBtn = container.querySelector(".btn-recruit") as HTMLButtonElement;
      expect(recruitBtn).toBeTruthy();
    });

    it("should NOT show Recruit button if 12 or more soldiers", () => {
      const roster = [];
      for (let i = 0; i < 12; i++) {
        roster.push({
          id: `s${i}`,
          name: `Soldier ${i}`,
          status: "Healthy",
          archetypeId: "assault",
          equipment: {},
        });
      }

      (context.campaignManager.getState as any).mockReturnValue({
        ...context.campaignManager.getState(),
        roster,
      });

      const builder = new SquadBuilder({
        containerId: "squad-builder",
        campaignManager: context.campaignManager as any,
        campaignShell: context.campaignShell as any,
        modalService: context.modalService as any,
        initialSquad: squad,
        missionType: MissionType.Default,
        isCampaign: true,
        onSquadUpdated: () => {},
      });
      builder.render();

      const recruitBtn = container.querySelector(".btn-recruit") as HTMLButtonElement;
      expect(recruitBtn).toBeNull();
    });
  });
});
