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
        <div id="screen-main-menu">
           <p id="menu-version"></p>
           <button id="btn-menu-campaign"></button>
           <button id="btn-menu-custom"></button>
           <button id="btn-menu-statistics"></button>
           <button id="btn-menu-reset"></button>
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
        <div id="screen-statistics"></div>
      </div>
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
    
    // Click back
    const backBtn = document.querySelector("#screen-statistics .back-button") as HTMLElement;
    backBtn?.click();
    
    expect(document.getElementById("screen-main-menu")?.style.display).toBe("flex");
    expect(document.getElementById("screen-statistics")?.style.display).toBe("none");
  });
});
