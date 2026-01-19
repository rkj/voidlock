// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameApp } from "@src/renderer/app/GameApp";
import { MetaManager } from "@src/renderer/campaign/MetaManager";

// Mock Worker
global.Worker = vi.fn().mockImplementation(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  postMessage: vi.fn(),
  terminate: vi.fn(),
}));

// Mock URL
global.URL.createObjectURL = vi.fn();

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({})
});

const mockModalService = {
  alert: vi.fn().mockResolvedValue(undefined),
  confirm: vi.fn().mockResolvedValue(true),
  show: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@src/renderer/ui/ModalService", () => ({
  ModalService: vi.fn().mockImplementation(() => mockModalService),
}));

// Mock MetaManager
vi.mock("@src/renderer/campaign/MetaManager", () => {
  return {
    MetaManager: {
      getInstance: vi.fn()
    }
  };
});

// Mock ThemeManager
vi.mock("@src/renderer/ThemeManager", () => {
  const mockInstance = {
    init: vi.fn().mockResolvedValue(undefined),
    setTheme: vi.fn()
  };
  return {
    ThemeManager: {
      getInstance: vi.fn(() => mockInstance)
    }
  };
});

describe("StatisticsScreen Integration", () => {
  let app: GameApp;
  const mockStats = {
    totalKills: 150,
    campaignsWon: 5,
    campaignsLost: 2,
    totalCampaignsStarted: 7,
    totalCasualties: 10,
    totalMissionsPlayed: 20,
    totalMissionsWon: 18,
    totalScrapEarned: 5000
  };

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="app">
      <div id="screen-main-menu" class="screen">
        <button id="btn-menu-campaign">Campaign</button>
        <button id="btn-menu-statistics">Statistics</button>
        <p id="menu-version"></p>
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
      <div id="screen-mission-setup" class="screen" style="display:none">
        <div id="mission-setup-context"></div>
        <div id="squad-builder"></div>
        <select id="mission-type"></select>
        <select id="map-generator-type"></select>
        <input id="map-seed" />
        <input id="map-width" />
        <input id="map-height" />
        <input id="map-spawn-points" />
        <span id="map-spawn-points-value"></span>
        <input id="map-starting-threat" />
        <span id="map-starting-threat-value"></span>
        <input id="map-base-enemies" />
        <span id="map-base-enemies-value"></span>
        <input id="map-enemy-growth" />
        <span id="map-enemy-growth-value"></span>
        <input id="toggle-fog-of-war" type="checkbox" />
        <input id="toggle-debug-overlay" type="checkbox" />
        <input id="toggle-los-overlay" type="checkbox" />
        <input id="toggle-agent-control" type="checkbox" />
        <input id="toggle-allow-tactical-pause" type="checkbox" />
        <select id="select-unit-style"></select>
        <button id="btn-goto-equipment"></button>
        <button id="btn-setup-back"></button>
      </div>
      <div id="screen-mission" class="screen" style="display:none">
        <button id="btn-pause-toggle"></button>
        <input id="game-speed" type="range" />
        <span id="speed-value"></span>
        <input id="time-scale-slider" type="range" />
        <span id="time-scale-value"></span>
        <button id="btn-give-up"></button>
        <div id="top-threat-fill"></div>
        <span id="top-threat-value"></span>
        <div id="game-canvas-container">
            <canvas id="game-canvas"></canvas>
        </div>
      </div>
      <div id="screen-debrief" class="screen" style="display:none"></div>
      <div id="screen-campaign-summary" class="screen" style="display:none"></div>
    `;

    (MetaManager.getInstance as any).mockReturnValue({
      getStats: () => mockStats
    });

    app = new GameApp();
  });

  it("should navigate to statistics screen when button is clicked", async () => {
    await app.initialize();
    
    const btn = document.getElementById("btn-menu-statistics");
    btn?.click();
    
    const screen = document.getElementById("screen-statistics");
    expect(screen?.style.display).toBe("flex");
    expect(screen?.textContent).toContain("Service Record");
    expect(screen?.textContent).toContain("Total Xeno Kills");
    expect(screen?.textContent).toContain("150");
  });

  it("should return to main menu from statistics screen", async () => {
    await app.initialize();
    
    // Go to stats
    document.getElementById("btn-menu-statistics")?.click();
    
    // Click Main Menu button in the shell
    const backBtn = Array.from(document.querySelectorAll("#campaign-shell-top-bar button")).find(b => b.textContent === "Main Menu") as HTMLElement;
    expect(backBtn).toBeTruthy();
    backBtn?.click();
    
    expect(document.getElementById("screen-main-menu")?.style.display).toBe("flex");
    expect(document.getElementById("screen-statistics")?.style.display).toBe("none");
  });
});
