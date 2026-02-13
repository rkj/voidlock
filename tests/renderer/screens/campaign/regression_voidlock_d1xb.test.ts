/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NewCampaignWizard } from "@src/renderer/screens/campaign/NewCampaignWizard";
import { ConfigManager } from "@src/renderer/ConfigManager";

// Mock MetaManager
vi.mock("@src/renderer/campaign/MetaManager", () => ({
  MetaManager: {
    getInstance: () => ({
      getStats: () => ({
        totalKills: 0,
        totalCampaignsStarted: 0,
        totalMissionsWon: 0,
      }),
    }),
  },
}));

// Mock ConfigManager
vi.mock("@src/renderer/ConfigManager", () => ({
  ConfigManager: {
    clearCampaign: vi.fn(),
    loadGlobal: vi
      .fn()
      .mockReturnValue({ unitStyle: "TacticalIcons", themeId: "default" }),
    saveGlobal: vi.fn(),
  },
}));

describe("regression_voidlock_d1xb: Clear cached squad on new campaign start", () => {
  let container: HTMLElement;
  const onStartCampaign = vi.fn();
  const onBack = vi.fn();

  beforeEach(() => {
    document.body.innerHTML = '<div id="container"></div>';
    container = document.getElementById("container")!;
    onStartCampaign.mockClear();
    onBack.mockClear();
    vi.mocked(ConfigManager.clearCampaign).mockClear();
  });

  it("should call ConfigManager.clearCampaign() when 'Initialize Expedition' is clicked", () => {
    const wizard = new NewCampaignWizard(container, {
      onStartCampaign,
      onBack,
    });
    wizard.render();

    const startBtn = container.querySelector(".primary-button") as HTMLElement;
    expect(startBtn.textContent).toBe("Initialize Expedition");

    // Trigger the click
    startBtn.click();

    // Verify ConfigManager.clearCampaign was called
    expect(ConfigManager.clearCampaign).toHaveBeenCalledTimes(1);

    // Verify onStartCampaign was also called
    expect(onStartCampaign).toHaveBeenCalled();
  });
});
