/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NewCampaignWizard } from "@src/renderer/screens/campaign/NewCampaignWizard";
import { t } from "@src/renderer/i18n";
import { I18nKeys } from "@src/renderer/i18n/keys";

// Pre-define mocks for usage in instance members
const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    unitStyle: "TacticalIcons",
    themeId: "default",
    locale: "en-corporate",
  },
}));

// Mock ConfigManager
vi.mock("@src/renderer/ConfigManager", () => ({
  ConfigManager: {
    loadGlobal: vi.fn(() => mockConfig),
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

describe("NewCampaignWizard", () => {
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

  it("should render the wizard title and content", () => {
    wizard.render();

    expect(container.innerHTML).toContain(t(I18nKeys.screen.campaign.wizard.title));
    expect(container.innerHTML).toContain(t(I18nKeys.screen.campaign.wizard.difficulty_label));
    expect(container.querySelectorAll(".difficulty-card").length).toBe(4);
  });

  it("should select a difficulty and call onStartCampaign with correct parameters", () => {
    wizard.render();

    const hardCard = Array.from(
      container.querySelectorAll(".difficulty-card"),
    ).find((el) =>
      el.textContent?.includes(t(I18nKeys.screen.campaign.wizard.diff_standard).split(" (")[0]),
    ) as HTMLElement;

    expect(hardCard).toBeDefined();
    hardCard.click();

    const startBtn = container.querySelector(
      '[data-focus-id="btn-start-campaign"]',
    ) as HTMLButtonElement;
    startBtn.click();

    expect(onStartCampaign).toHaveBeenCalledWith(
      expect.any(Number),
      "Standard",
      expect.any(Object),
    );
  });

  it("should disable tactical pause in Ironman mode", () => {
    wizard.render();

    const ironmanCard = Array.from(
      container.querySelectorAll(".difficulty-card"),
    ).find((el) =>
      el.textContent?.includes(t(I18nKeys.screen.campaign.wizard.diff_ironman).split(" (")[0]),
    ) as HTMLElement;

    expect(ironmanCard).not.toBeNull();
    ironmanCard.click();

    const pauseCheck = container.querySelector(
      "#campaign-tactical-pause",
    ) as HTMLInputElement;
    expect(pauseCheck.checked).toBe(false);
    expect(pauseCheck.disabled).toBe(true);
  });

  it("should toggle advanced options", () => {
    wizard.render();

    const advancedToggle = Array.from(
      container.querySelectorAll("button"),
    ).find((b) => b.textContent === t(I18nKeys.screen.campaign.wizard.advanced_show)) as HTMLElement;
    const advancedContent = container.querySelector(".flex-col.gap-15") as HTMLElement;

    expect(advancedToggle).not.toBeNull();
    expect(advancedContent.style.display).toBe("none");

    advancedToggle.click();
    expect(advancedContent.style.display).toBe("flex");
    expect(advancedToggle.textContent).toContain(t(I18nKeys.screen.campaign.wizard.advanced_hide));
  });
});
