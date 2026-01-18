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

describe("GlobalStats Integration", () => {
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
        <div id="screen-main-menu">
           <p id="menu-version"></p>
           <div id="global-stats-tally"></div>
        </div>
        <div id="mission-setup-context"></div>
        <div id="map-config-section">
           <div class="control-group">
             <select id="map-generator-type"></select>
           </div>
        </div>
        <div id="squad-builder"></div>
        <input id="map-width" />
        <input id="map-height" />
        <input id="map-spawn-points" />
        <input id="map-seed" />
        <div id="screen-campaign"></div>
        <div id="screen-mission-setup"></div>
        <div id="screen-equipment"></div>
        <div id="screen-barracks"></div>
        <div id="screen-mission"></div>
        <div id="screen-debrief"></div>
        <div id="screen-campaign-summary"></div>
      </div>
    `;

    (MetaManager.getInstance as any).mockReturnValue({
      getStats: () => mockStats
    });

    app = new GameApp();
  });

  it("should display global stats in the main menu on initialization", async () => {
    await app.initialize();
    
    const el = document.getElementById("global-stats-tally");
    expect(el?.textContent).toBe("Total Kills: 150 | Campaigns Won: 5");
  });

  it("should update global stats when showing main menu", async () => {
    await app.initialize();
    
    // Change stats
    mockStats.totalKills = 200;
    mockStats.campaignsWon = 6;
    
    // Trigger showMainMenu (indirectly via abortMission or start)
    (app as any).showMainMenu();
    
    const el = document.getElementById("global-stats-tally");
    expect(el?.textContent).toBe("Total Kills: 200 | Campaigns Won: 6");
  });
});