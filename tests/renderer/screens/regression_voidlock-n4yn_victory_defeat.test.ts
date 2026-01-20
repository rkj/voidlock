// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignSummaryScreen } from "@src/renderer/screens/CampaignSummaryScreen";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";

describe("CampaignSummaryScreen Victory/Defeat Screens", () => {
  let container: HTMLElement;
  let manager: CampaignManager;
  let onMainMenu: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-campaign-summary"></div>';
    container = document.getElementById("screen-campaign-summary")!;

    CampaignManager.resetInstance();
    manager = CampaignManager.getInstance(
      new (class {
        save() {}
        load() {
          return null;
        }
        remove() {}
        clear() {}
      })(),
    );
    onMainMenu = vi.fn();
  });

  it("should render Victory screen when campaign status is Victory", () => {
    manager.startNewCampaign(12345, "normal");
    const state = manager.getState()!;
    state.status = "Victory";
    state.history.push({
      nodeId: "node_1",
      seed: 1,
      result: "Won",
      aliensKilled: 42,
      scrapGained: 100,
      intelGained: 10,
      timeSpent: 1000,
      soldierResults: []
    });

    const screen = new CampaignSummaryScreen(
      "screen-campaign-summary",
      onMainMenu,
    );
    screen.show(state);

    expect(container.textContent).toContain("Sector Secured");
    expect(container.textContent).toContain("Aliens Killed:");
    expect(container.textContent).toContain("42");
    expect(container.textContent).toContain("Missions:");
    expect(container.textContent).toContain("1");

    const menuBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Retire to Main Menu",
    );
    expect(menuBtn).toBeDefined();

    menuBtn?.click();
    expect(onMainMenu).toHaveBeenCalled();
  });

  it("should render Defeat screen when campaign status is Defeat (Mission Failure)", () => {
    manager.startNewCampaign(12345, "extreme");
    const state = manager.getState()!;
    state.status = "Defeat";
    state.history.push({
      nodeId: "node_1",
      seed: 1,
      result: "Lost",
      aliensKilled: 5,
      scrapGained: 0,
      intelGained: 0,
      timeSpent: 500,
      soldierResults: []
    });

    const screen = new CampaignSummaryScreen(
      "screen-campaign-summary",
      onMainMenu,
    );
    screen.show(state);

    expect(container.textContent).toContain("Mission Failed");
    expect(container.textContent).toContain("Cause: Squad Wiped");

    const abandonBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Abandon Expedition",
    );
    expect(abandonBtn).toBeDefined();

    abandonBtn?.click();
    expect(onMainMenu).toHaveBeenCalled();
  });

  it("should render Defeat screen when campaign status is Defeat (Bankruptcy)", () => {
    manager.startNewCampaign(12345, "normal");
    const state = manager.getState()!;
    state.status = "Defeat";
    state.scrap = 50;
    state.roster.forEach(s => s.status = "Dead");

    const screen = new CampaignSummaryScreen(
      "screen-campaign-summary",
      onMainMenu,
    );
    screen.show(state);

    expect(container.textContent).toContain("Mission Failed");
    expect(container.textContent).toContain("Cause: Bankruptcy");
  });
});
