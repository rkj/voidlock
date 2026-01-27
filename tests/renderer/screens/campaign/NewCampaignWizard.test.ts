/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NewCampaignWizard } from "@src/renderer/screens/campaign/NewCampaignWizard";

// Mock MetaManager
vi.mock("@src/renderer/campaign/MetaManager", () => ({
  MetaManager: {
    getInstance: () => ({
      getStats: () => ({
        totalKills: 1000,
        totalCampaignsStarted: 5,
        totalMissionsWon: 10,
      }),
    }),
  },
}));

describe("NewCampaignWizard", () => {
  let container: HTMLElement;
  const onStartCampaign = vi.fn();
  const onBack = vi.fn();

  beforeEach(() => {
    document.body.innerHTML = '<div id="container"></div>';
    container = document.getElementById("container")!;
    onStartCampaign.mockClear();
    onBack.mockClear();
  });

  it("should render the wizard title and content", () => {
    const wizard = new NewCampaignWizard(container, {
      onStartCampaign,
      onBack,
    });
    wizard.render();

    expect(container.innerHTML).toContain("NEW EXPEDITION");
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
    expect(difficulty).toBe("hard");
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

  it("should render meta statistics in the footer", () => {
    const wizard = new NewCampaignWizard(container, {
      onStartCampaign,
      onBack,
    });
    wizard.render();

    expect(container.innerHTML).toContain("Lifetime Xeno Purged:");
    expect(container.innerHTML).toContain("1,000");
    expect(container.innerHTML).toContain("Expeditions:");
    expect(container.innerHTML).toContain("5");
  });
});
