/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NewCampaignWizard } from "@src/renderer/screens/campaign/NewCampaignWizard";

// Pre-define mocks for usage in instance members
const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    unitStyle: "TacticalIcons",
    themeId: "default",
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
vi.mock("@src/renderer/campaign/MetaManager", () => {
  const mockInstance = {
    getStats: vi.fn().mockReturnValue({
      totalKills: 0,
      totalCampaignsStarted: 0,
      campaignsWon: 0,
      campaignsLost: 0,
      totalMissionsWon: 0,
      totalMissionsPlayed: 0,
      totalCasualties: 0,
      totalScrapEarned: 0,
      currentIntel: 0,
      unlockedArchetypes: [],
      unlockedItems: [],
      prologueCompleted: false,
    }),
    load: vi.fn(),
  };
  const mockConstructor = vi.fn().mockImplementation(() => mockInstance);
  (mockConstructor as any).getInstance = vi.fn().mockReturnValue(mockInstance);
  return { MetaManager: mockConstructor };
});

describe("NewCampaignWizard", () => {
  let container: HTMLElement;
  let onStartCampaign: any;
  let onBack: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="wizard-container"></div>';
    container = document.getElementById("wizard-container")!;
    onStartCampaign = vi.fn();
    onBack = vi.fn();
  });

  it("should render the wizard title and content", () => {
    const wizard = new NewCampaignWizard(container, {
      onStartCampaign,
      onBack,
    });
    wizard.render();

    expect(container.innerHTML).toContain("New Expedition");
    expect(container.innerHTML).toContain("Select Difficulty");
    expect(container.querySelectorAll(".difficulty-card").length).toBe(4);
  });

  it("should select a difficulty and call onStartCampaign with correct parameters", () => {
    const wizard = new NewCampaignWizard(container, {
      onStartCampaign,
      onBack,
    });
    wizard.render();

    const hardCard = Array.from(
      container.querySelectorAll(".difficulty-card"),
    ).find(
      (c) => c.querySelector("h3")?.textContent === "Standard",
    ) as HTMLElement;

    expect(hardCard).toBeDefined();
    hardCard.click();

    const startBtn = container.querySelector(".primary-button") as HTMLElement;
    expect(startBtn.textContent).toBe("Initialize Expedition");
    startBtn.click();

    expect(onStartCampaign).toHaveBeenCalled();
    const [seed, difficulty, overrides] = onStartCampaign.mock.calls[0];
    expect(typeof seed).toBe("number");
    expect(difficulty).toBe("Standard");
    expect(overrides.allowTacticalPause).toBe(true);
  });

  it("should disable tactical pause in Ironman mode", () => {
    const wizard = new NewCampaignWizard(container, {
      onStartCampaign,
      onBack,
    });
    wizard.render();

    const ironmanCard = Array.from(
      container.querySelectorAll(".difficulty-card"),
    ).find(
      (c) => c.querySelector("h3")?.textContent === "Ironman",
    ) as HTMLElement;

    ironmanCard.click();

    const pauseCheck = container.querySelector(
      "#campaign-tactical-pause",
    ) as HTMLInputElement;
    expect(pauseCheck.checked).toBe(false);
    expect(pauseCheck.disabled).toBe(true);
  });

  it("should toggle advanced options", () => {
    const wizard = new NewCampaignWizard(container, {
      onStartCampaign,
      onBack,
    });
    wizard.render();

    const advancedToggle = Array.from(
      container.querySelectorAll("button"),
    ).find((b) =>
      b.textContent?.includes("Show Advanced Settings"),
    ) as HTMLElement;

    const advancedContent = container.querySelector(
      ".flex-col.gap-15",
    ) as HTMLElement;
    expect(advancedContent.style.display).toBe("none");

    advancedToggle.click();
    expect(advancedContent.style.display).toBe("flex");
    expect(advancedToggle.textContent).toContain("Hide Advanced Settings");
  });

  it("should NOT render meta statistics in the footer (responsibility moved to shell)", () => {
    const wizard = new NewCampaignWizard(container, {
      onStartCampaign,
      onBack,
    });
    wizard.render();

    expect(container.innerHTML).not.toContain("Lifetime Xeno Purged:");
    expect(container.querySelector(".campaign-footer")).toBeNull();
  });

  it("should allow selecting campaign duration", () => {
    const wizard = new NewCampaignWizard(container, {
      onStartCampaign,
      onBack,
    });
    wizard.render();

    const durationSelect = container.querySelector(
      "#campaign-duration",
    ) as HTMLSelectElement;
    expect(durationSelect).toBeDefined();
    expect(durationSelect.value).toBe("0.5"); // Default Long

    durationSelect.value = "1.0"; // Select Short
    durationSelect.dispatchEvent(new Event("change"));

    const startBtn = container.querySelector(".primary-button") as HTMLElement;
    startBtn.click();

    expect(onStartCampaign).toHaveBeenCalled();
    const [, , overrides] = onStartCampaign.mock.calls[0];
    expect(overrides.mapGrowthRate).toBe(1.0);
  });
});
