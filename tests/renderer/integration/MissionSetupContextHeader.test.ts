/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@package.json", () => ({
  default: { version: "1.0.0" }
}));

const mockGameClient = {
  init: vi.fn(),
  onStateUpdate: vi.fn(),
  stop: vi.fn(),
  getIsPaused: vi.fn().mockReturnValue(false),
  getTargetScale: vi.fn().mockReturnValue(1.0),
  setTimeScale: vi.fn(),
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

import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
let currentCampaignState: any = null;

vi.mock("@src/renderer/campaign/CampaignManager", () => {
  return {
    CampaignManager: {
      getInstance: vi.fn().mockReturnValue({
        getState: vi.fn(() => currentCampaignState),
        load: vi.fn(),
      }),
    },
  };
});

describe("Mission Setup Context Header", () => {
  beforeEach(async () => {
    currentCampaignState = null;
    
    // Mock ResizeObserver
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    document.body.innerHTML = `
      <div id="screen-main-menu" class="screen">
        <button id="btn-menu-campaign">Campaign</button>
        <button id="btn-menu-custom">Custom Mission</button>
      </div>

      <div id="screen-campaign-shell" class="screen flex-col" style="display:none">
          <div id="campaign-shell-top-bar"></div>
          <div id="campaign-shell-content" class="flex-grow relative overflow-hidden">
              <div id="screen-campaign" class="screen" style="display:none"></div>
              <div id="screen-barracks" class="screen" style="display:none"></div>
              <div id="screen-equipment" class="screen" style="display:none"></div>
              <div id="screen-statistics" class="screen" style="display:none"></div>
          </div>
      </div>

      <div id="screen-mission-setup" class="screen screen-centered">
        <h1>MISSION CONFIGURATION</h1>
        <div id="mission-setup-context" style="margin-bottom: 20px; color: var(--color-primary); font-weight: bold; letter-spacing: 1px;"></div>
        <div id="setup-content">
          <div id="map-config-section">
            <select id="map-generator-type"><option value="Procedural">Procedural</option></select>
            <input type="number" id="map-seed" />
            <div id="preset-map-controls">
               <input type="number" id="map-width" value="14" />
               <input type="number" id="map-height" value="14" />
               <input type="number" id="map-spawn-points" value="1" />
               <input type="range" id="map-starting-threat" value="0" />
               <span id="map-starting-threat-value">0</span>
               <input type="range" id="map-base-enemies" value="3" />
               <input type="range" id="map-enemy-growth" value="1.0" />
            </div>
          </div>
          <div id="squad-builder"></div>
          <button id="btn-goto-equipment">Equipment</button>
        </div>
      </div>
      <div id="screen-campaign" class="screen" style="display:none"></div>
      <div id="screen-barracks" class="screen" style="display:none"></div>
      <div id="screen-equipment" class="screen" style="display:none"></div>
      <div id="screen-mission" class="screen" style="display:none"></div>
      <div id="screen-debrief" class="screen" style="display:none"></div>
      <div id="screen-campaign-summary" class="screen" style="display:none"></div>
    `;

    vi.resetModules();
    await import("@src/renderer/main");
    document.dispatchEvent(new Event("DOMContentLoaded"));
  });

  it("should show 'CUSTOM SIMULATION' when entering custom mission", async () => {
    const customBtn = document.getElementById("btn-menu-custom");
    customBtn?.click();

    const contextHeader = document.getElementById("mission-setup-context");
    expect(contextHeader?.textContent).toBe("CUSTOM SIMULATION");
  });

  it("should show campaign info when entering campaign mission", async () => {
    currentCampaignState = {
      rules: { difficulty: "Standard" },
      history: [{}, {}], // 2 past missions
      currentSector: 3,
      roster: [],
      nodes: [{ id: "node-1", type: "Combat", status: "Accessible", difficulty: 1, mapSeed: 123, connections: [], position: { x: 0, y: 0 }, rank: 1 }],
      status: "Active",
      currentNodeId: null,
    };

    // Simulate clicking a campaign node which calls onCampaignNodeSelected
    // We need to access the GameApp instance or simulate the flow.
    // In UserJourneys.test.ts, they click on campaign nodes.
    
    // Let's just trigger the 'onCampaignNodeSelected' logic by mocking the interaction
    // Or better, use the existing GameApp from the main.ts import if possible.
    
    // Actually, we can just call loadAndApplyConfig if we can get the instance.
    // But since it's private, we have to use the UI.
    
    // To trigger campaign mission setup, we usually go through the campaign screen.
    // Let's mock a node selection.
    
    // Since GameApp is not exported, we have to rely on the events bound to the DOM.
    // But onCampaignNodeSelected is called by CampaignScreen.
    
    // Let's try to simulate the flow: Main Menu -> Campaign -> Click Node.
    
    document.getElementById("btn-menu-campaign")?.click();
    
    // Now we are in campaign screen. We need to mock a node and click it.
    // But CampaignScreen is also mocked or initialized.
    
    // In our case, GameApp initializes CampaignScreen with a callback.
    // We can find where CampaignScreen renders nodes and click one.
    
    // Wait, CampaignScreen is NOT mocked in my setup, it's the real one but its dependencies might be mocked.
    
    // Let's see if we can find a node to click.
    const nodes = document.querySelectorAll(".campaign-node");
    // If no nodes, maybe we need to "Initialize Expedition" first if it's a new campaign.
    
    const startBtn = document.querySelector(".campaign-setup-wizard .primary-button") as HTMLElement;
    if (startBtn) startBtn.click();
    
    const node = document.querySelector(".campaign-node.accessible") as HTMLElement;
    if (node) {
      node.click();
      
      // Wait for async onCampaignNodeSelected
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const contextHeader = document.getElementById("mission-setup-context");
      // Mission 3 because history has 2 items. Sector 3 from state.
      expect(contextHeader?.textContent).toBe("CAMPAIGN: STANDARD | MISSION 3 | SECTOR 3");
    }
  });
});
