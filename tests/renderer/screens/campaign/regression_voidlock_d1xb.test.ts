// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NewCampaignWizard } from "@src/renderer/screens/campaign/NewCampaignWizard";
import { ConfigManager } from "@src/renderer/ConfigManager";
import { t } from "@src/renderer/i18n";
import { I18nKeys } from "@src/renderer/i18n/keys";

// Mock ConfigManager
vi.mock("@src/renderer/ConfigManager", () => ({
  ConfigManager: {
    loadGlobal: vi.fn(() => ({
      unitStyle: "TacticalIcons",
      themeId: "default",
      locale: "en-corporate",
    })),
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
      totalKills: 1000,
      totalCampaignsStarted: 5,
      totalMissionsWon: 3,
    }),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  
  return { MetaManager: mockConstructor };
});

describe("regression_voidlock_d1xb: Clear cached squad on new campaign start", () => {
  let container: HTMLElement;
  let onStartCampaign: any;
  let onBack: any;
  let wizard: NewCampaignWizard;

  beforeEach(() => {
    container = document.createElement("div");
    container.id = "wizard-container";
    document.body.appendChild(container);

    onStartCampaign = vi.fn();
    onBack = vi.fn();

    wizard = new NewCampaignWizard(container, {
      metaStats: { prologueCompleted: false } as any,
      onStartCampaign,
      onBack,
    });
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.clearAllMocks();
  });

  it("should call ConfigManager.clearCampaign() when 'Initialize Expedition' is clicked", () => {
    wizard.render();

    const startBtn = container.querySelector(".primary-button") as HTMLButtonElement;
    expect(startBtn.textContent).toBe(t(I18nKeys.screen.campaign.wizard.initialize_btn));

    // Trigger the click
    startBtn.click();

    // Verify clearCampaign was called
    expect(ConfigManager.clearCampaign).toHaveBeenCalled();
    expect(onStartCampaign).toHaveBeenCalled();
  });
});
