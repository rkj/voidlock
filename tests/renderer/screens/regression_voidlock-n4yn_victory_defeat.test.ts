// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignScreen } from "@src/renderer/screens/CampaignScreen";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";

describe("CampaignScreen Victory/Defeat Screens", () => {
  let container: HTMLElement;
  let manager: CampaignManager;
  let onNodeSelect: any;
  let onBarracks: any;
  let onBack: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-campaign"></div>';
    container = document.getElementById("screen-campaign")!;

    // Mock ResizeObserver
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

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
    onNodeSelect = vi.fn();
    onBarracks = vi.fn();
    onBack = vi.fn();
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

    const screen = new CampaignScreen(
      "screen-campaign",
      manager,
      onNodeSelect,
      onBarracks,
      onBack,
    );
    screen.show();

    expect(container.textContent).toContain("SECTOR SECURED");
    expect(container.textContent).toContain("ALIENS KILLED: 42");
    expect(container.textContent).toContain("MISSIONS: 1");

    const menuBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "RETURN TO MAIN MENU",
    );
    expect(menuBtn).toBeDefined();

    const deleteSaveSpy = vi.spyOn(manager, "deleteSave");
    menuBtn?.click();

    expect(deleteSaveSpy).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalled();
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

    const screen = new CampaignScreen(
      "screen-campaign",
      manager,
      onNodeSelect,
      onBarracks,
      onBack,
    );
    screen.show();

    expect(container.textContent).toContain("MISSION FAILED");
    expect(container.textContent).toContain("CAUSE: SQUAD WIPED");

    const abandonBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "ABANDON CAMPAIGN",
    );
    expect(abandonBtn).toBeDefined();

    const deleteSaveSpy = vi.spyOn(manager, "deleteSave");
    abandonBtn?.click();

    expect(deleteSaveSpy).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalled();
  });

  it("should render Defeat screen when campaign status is Defeat (Bankruptcy)", () => {
    manager.startNewCampaign(12345, "normal");
    const state = manager.getState()!;
    state.status = "Defeat";
    state.scrap = 50;
    state.roster.forEach(s => s.status = "Dead");

    const screen = new CampaignScreen(
      "screen-campaign",
      manager,
      onNodeSelect,
      onBarracks,
      onBack,
    );
    screen.show();

    expect(container.textContent).toContain("MISSION FAILED");
    expect(container.textContent).toContain("CAUSE: BANKRUPTCY");
  });
});
