// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameApp } from "@src/renderer/app/GameApp";
import { t } from "@src/renderer/i18n";
import { I18nKeys } from "@src/renderer/i18n/keys";

// Mock dependencies
vi.mock("@src/engine/GameClient", () => ({
  GameClient: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    start: vi.fn(),
    onObservation: vi.fn(),
    sendCommand: vi.fn(),
    onMessage: vi.fn(),
    freezeForDialog: vi.fn(),
    unfreezeAfterDialog: vi.fn(),
  })),
}));

vi.mock("@src/renderer/ConfigManager", () => ({
  ConfigManager: {
    loadGlobal: vi.fn().mockReturnValue({
      unitStyle: "TacticalIcons",
      themeId: "default",
      locale: "en-corporate",
    }),
    saveGlobal: vi.fn(),
    loadCampaign: vi.fn().mockReturnValue(null),
    saveCampaign: vi.fn(),
    clearCampaign: vi.fn(),
  },
}));

// Mock MetaManager
vi.mock("@src/engine/campaign/MetaManager", () => {
  const mockInstance = {
    getStats: vi.fn().mockReturnValue({
      totalKills: 150,
      totalCampaignsStarted: 5,
      campaignsWon: 3,
      campaignsLost: 2,
      totalCasualties: 2,
      totalMissionsPlayed: 10,
      totalMissionsWon: 3,
      totalScrapEarned: 1000,
    }),
    addChangeListener: vi.fn(),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  (mockConstructor as any).getInstance = vi.fn().mockReturnValue(mockInstance);
  return { MetaManager: mockConstructor };
});

describe("StatisticsScreen Integration", () => {
  let app: GameApp;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="app">
        <div id="screen-main" class="screen">
          <button id="btn-menu-statistics">Stats</button>
        </div>
        <div id="screen-statistics" class="screen"></div>
        <div id="screen-campaign" class="screen"></div>
        <div id="mission-body"></div>
        <div id="screen-mission"></div>
      </div>
      <div id="modal-container"></div>
    `;

    app = new GameApp();
    await app.initialize();
  });

  it("should navigate to statistics screen when button is clicked", async () => {
    // 1. Click stats button
    const statsBtn = document.getElementById("btn-menu-statistics");
    statsBtn?.click();

    // 2. Verify navigation
    const screen = document.getElementById("screen-statistics");
    expect(screen?.style.display).toBe("flex");

    // Verify stats are rendered
    expect(screen?.textContent).toContain(t(I18nKeys.screen.statistics.title));
    expect(screen?.textContent).toContain(t(I18nKeys.screen.statistics.stat_expeditions_won));
    expect(screen?.textContent).toContain(t(I18nKeys.screen.statistics.stat_expeditions_lost));
  });
});
