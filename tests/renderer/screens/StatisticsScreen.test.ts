// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatisticsScreen } from "@src/renderer/screens/StatisticsScreen";
import { t } from "@src/renderer/i18n";
import { I18nKeys } from "@src/renderer/i18n/keys";

describe("StatisticsScreen", () => {
  let container: HTMLElement;
  let mockMetaManager: any;
  let mockInputDispatcher: any;
  let screen: StatisticsScreen;

  beforeEach(() => {
    container = document.createElement("div");
    container.id = "stats-container";
    document.body.appendChild(container);

    mockMetaManager = {
      getStats: vi.fn().mockReturnValue({
        totalKills: 0,
        totalCampaignsStarted: 0,
        campaignsWon: 0,
        campaignsLost: 0,
        totalCasualties: 0,
        totalMissionsPlayed: 0,
        totalMissionsWon: 0,
        totalScrapEarned: 0,
      }),
    };

    mockInputDispatcher = {
      pushContext: vi.fn(),
      popContext: vi.fn(),
    };

    screen = new StatisticsScreen({
      containerId: "stats-container",
      metaManager: mockMetaManager,
      inputDispatcher: mockInputDispatcher,
    });
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should render correctly with default stats", () => {
    screen.show();

    expect(container.textContent).toContain(t(I18nKeys.screen.statistics.title));
    expect(container.textContent).toContain(t(I18nKeys.screen.statistics.header_campaigns));
    expect(container.textContent).toContain(t(I18nKeys.screen.statistics.header_combat));
  });

  it("should render correctly with updated stats", () => {
    mockMetaManager.getStats.mockReturnValue({
      totalKills: 10,
      totalCampaignsStarted: 1,
      campaignsWon: 1,
      campaignsLost: 0,
      totalCasualties: 2,
      totalMissionsPlayed: 1,
      totalMissionsWon: 1,
      totalScrapEarned: 500,
    });

    screen.show();

    expect(container.textContent).toContain(t(I18nKeys.screen.statistics.stat_total_xeno_purged));
    expect(container.textContent).toContain("10");
    expect(container.textContent).toContain(t(I18nKeys.screen.statistics.stat_total_casualties));
    expect(container.textContent).toContain("2");
    expect(container.textContent).toContain("500");
  });
});
