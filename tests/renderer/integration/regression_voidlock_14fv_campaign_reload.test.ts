/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MapGeneratorType } from "@src/shared/types";
import { CampaignState } from "@src/shared/campaign_types";

// Mock dependencies before importing main.ts
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" },
}));

vi.mock("@src/engine/GameClient", () => ({
  GameClient: vi.fn().mockImplementation(() => ({
    init: vi.fn(),
    onStateUpdate: vi.fn(),
    addStateUpdateListener: vi.fn(),
    removeStateUpdateListener: vi.fn(),
    stop: vi.fn(),
    getIsPaused: vi.fn().mockReturnValue(false),
    getTargetScale: vi.fn().mockReturnValue(1.0),
  setTimeScale: vi.fn(),
  getTimeScale: vi.fn().mockReturnValue(1.0),
    toggleDebugOverlay: vi.fn(),
    toggleLosOverlay: vi.fn(),
  })),
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

vi.mock("@src/renderer/ui/ModalService", () => ({
  ModalService: vi.fn().mockImplementation(() => ({
    alert: vi.fn().mockResolvedValue(undefined),
    confirm: vi.fn().mockResolvedValue(true),
    prompt: vi.fn().mockResolvedValue("New Recruit"),
    show: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock CampaignManager
let currentCampaignState: CampaignState | null = null;

vi.mock("@src/renderer/campaign/CampaignManager", () => {
  return {
    CampaignManager: {
      getInstance: vi.fn().mockReturnValue({
        getState: vi.fn(() => currentCampaignState),
        getStorage: vi.fn(),
        getSyncStatus: vi.fn().mockReturnValue("local-only"),
        addChangeListener: vi.fn(),
        removeChangeListener: vi.fn(),
        load: vi.fn(() => !!currentCampaignState),
        save: vi.fn(),
        startNewCampaign: vi.fn((seed, diff, _pause, theme) => {
          currentCampaignState = {
            status: "Active",
            seed: seed || 123,
            version: "1.0.0",
            nodes: [
              {
                id: "node-1",
                type: "Combat",
                status: "Accessible",
                rank: 0,
                difficulty: 1,
                mapSeed: 456,
                connections: [],
                position: { x: 0, y: 0 },
                bonusLootCount: 0,
              },
            ],
            roster: [
              {
                id: "s1",
                name: "Soldier 1",
                archetypeId: "scout",
                status: "Healthy",
                level: 1,
                hp: 100,
                maxHp: 100,
                xp: 0,
                kills: 0,
                missions: 0,
                recoveryTime: 0,
                soldierAim: 80,
                equipment: {
                  rightHand: "pulse_rifle",
                },
              },
            ],
            scrap: 100,
            intel: 0,
            currentSector: 1,
            currentNodeId: null,
            history: [],
            unlockedArchetypes: ["scout"],
            rules: {
              difficulty: diff,
              allowTacticalPause: true,
              mapGeneratorType: MapGeneratorType.TreeShip,
              themeId: theme || "default",
            } as any,
          } as CampaignState;
        }),
      }),
    },
  };
});

describe("Regression voidlock-14fv: Campaign Mission Setup Reload", () => {
  beforeEach(async () => {
    currentCampaignState = null;
    localStorage.clear();

    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    document.body.innerHTML = `
      <div id="screen-main-menu" class="screen">
        <button id="btn-menu-campaign">Campaign</button>
      </div>
      <div id="screen-campaign-shell" class="screen flex-col" style="display:none">
          <div id="campaign-shell-top-bar"></div>
          <div id="campaign-shell-content">
              <div id="screen-engineering" class="screen" style="display:none"></div>
              <div id="screen-campaign" class="screen" style="display:none"></div>
              <div id="screen-barracks" class="screen" style="display:none"></div>
              <div id="screen-statistics" class="screen" style="display:none"></div>
              <div id="screen-settings" class="screen" style="display:none"></div>
              <div id="screen-mission-setup" class="screen" style="display:none">
                <div id="mission-setup-context"></div>
                <div id="map-config-section"></div>
                <div id="unit-style-preview"></div>
                <div id="squad-builder"></div>
                <button id="btn-goto-equipment">Equipment</button>
                <button id="btn-setup-back">Back</button>
                <input type="number" id="map-seed" />
                <input type="number" id="map-width" />
                <input type="number" id="map-height" />
                <input type="number" id="map-spawn-points" />
                <select id="map-generator-type"><option value="TreeShip">TreeShip</option></select>
                <select id="mission-type"><option value="Default">Default</option></select>
                <select id="select-unit-style"><option value="TacticalIcons">TacticalIcons</option></select>
                <input type="checkbox" id="toggle-fog-of-war" />
                <input type="checkbox" id="toggle-debug-overlay" />
                <input type="checkbox" id="toggle-los-overlay" />
                <input type="checkbox" id="toggle-agent-control" />
                <input type="checkbox" id="toggle-allow-tactical-pause" />
              </div>
              <div id="screen-equipment" class="screen" style="display:none"></div>
          </div>
      </div>
      <div id="screen-mission" class="screen" style="display:none"></div>
      <div id="screen-debrief" class="screen" style="display:none"></div>
      <div id="screen-campaign-summary" class="screen" style="display:none"></div>
      <div id="modal-container"></div>
    `;

    vi.resetModules();
    await import("@src/renderer/main");
    document.dispatchEvent(new Event("DOMContentLoaded"));
  });

  it("should restore campaign mission setup after reload", async () => {
    // 1. Start campaign
    document.getElementById("btn-menu-campaign")?.click();
    const startBtn = document.querySelector(
      ".campaign-setup-wizard .primary-button",
    ) as HTMLElement;
    startBtn.click();

    // 2. Select node
    const nodeEl = document.querySelector(".campaign-node") as HTMLElement;
    nodeEl.click();

    expect(document.getElementById("screen-equipment")?.style.display).toBe(
      "flex",
    );

    // 3. Simulate reload
    // Session state should have isCampaign: true
    const sessionState = JSON.parse(
      localStorage.getItem("voidlock_session_state")!,
    );
    expect(sessionState.isCampaign).toBe(true);

    // Campaign config should have campaignNodeId
    const campaignConfig = JSON.parse(
      localStorage.getItem("voidlock_campaign_config")!,
    );
    expect(campaignConfig.campaignNodeId).toBe("node-1");

    // Reset modules and re-import to simulate reload
    vi.resetModules();
    await import("@src/renderer/main");
    document.dispatchEvent(new Event("DOMContentLoaded"));

    // 4. Verify restoration (redirected to equipment)
    expect(document.getElementById("screen-equipment")?.style.display).toBe(
      "flex",
    );
  });
});
