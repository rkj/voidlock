// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignScreen } from "@src/renderer/screens/CampaignScreen";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { CampaignNode } from "@src/shared/campaign_types";

describe("CampaignScreen", () => {
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

  it("should render 'New Campaign' wizard when state is null", () => {
    const screen = new CampaignScreen(
      "screen-campaign",
      manager,
      onNodeSelect,
      onBarracks,
      onBack,
    );
    screen.show();

    expect(container.textContent).toContain("NEW CAMPAIGN");
    expect(container.querySelectorAll(".difficulty-card").length).toBe(4);
    expect(container.querySelector("#campaign-tactical-pause")).not.toBeNull();
  });

  it("should render Sector Map when campaign is active", () => {
    manager.startNewCampaign(12345, "normal");
    const screen = new CampaignScreen(
      "screen-campaign",
      manager,
      onNodeSelect,
      onBarracks,
      onBack,
    );
    screen.show();

    expect(container.textContent).toContain("SECTOR MAP");
    expect(container.textContent).toContain("SCRAP:");

    // Should find nodes
    const nodes = container.querySelectorAll(".campaign-node");
    expect(nodes.length).toBeGreaterThan(0);
  });

  it("should trigger onNodeSelect when an accessible node is clicked", () => {
    manager.startNewCampaign(12345, "normal");
    const screen = new CampaignScreen(
      "screen-campaign",
      manager,
      onNodeSelect,
      onBarracks,
      onBack,
    );
    screen.show();

    const accessibleNode = container.querySelector(
      ".campaign-node.accessible",
    ) as HTMLElement;
    expect(accessibleNode).not.toBeNull();

    accessibleNode.click();
    expect(onNodeSelect).toHaveBeenCalled();
  });

  it("should trigger onBarracks when barracks button is clicked", () => {
    manager.startNewCampaign(12345, "normal");
    const screen = new CampaignScreen(
      "screen-campaign",
      manager,
      onNodeSelect,
      onBarracks,
      onBack,
    );
    screen.show();

    const barracksBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "BARRACKS",
    );
    expect(barracksBtn).toBeDefined();
    barracksBtn?.click();

    expect(onBarracks).toHaveBeenCalled();
  });

  it("should render a 'current' indicator on the current node", () => {
    manager.startNewCampaign(12345, "normal");
    const state = manager.getState()!;
    // Set a node as cleared and mark it as current
    state.nodes[0].status = "Cleared";
    state.currentNodeId = state.nodes[0].id;

    const screen = new CampaignScreen(
      "screen-campaign",
      manager,
      onNodeSelect,
      onBarracks,
      onBack,
    );
    screen.show();

    const currentNode = container.querySelector(
      `.campaign-node[data-id="${state.currentNodeId}"]`,
    ) as HTMLElement;
    expect(currentNode).not.toBeNull();
    expect(currentNode.innerHTML).toContain("▲"); // Using triangle as indicator for now
  });

  it("should trigger onBack when back button is clicked", () => {
    const screen = new CampaignScreen(
      "screen-campaign",
      manager,
      onNodeSelect,
      onBarracks,
      onBack,
    );
    screen.show();

    const backBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "BACK TO MENU",
    );
    backBtn?.click();

    expect(onBack).toHaveBeenCalled();
  });

  it("should render Game Over screen when campaign status is Defeat", () => {
    manager.startNewCampaign(12345, "extreme");
    const state = manager.getState()!;
    state.status = "Defeat";

    const screen = new CampaignScreen(
      "screen-campaign",
      manager,
      onNodeSelect,
      onBarracks,
      onBack,
    );
    screen.show();

    expect(container.textContent).toContain("MISSION FAILED");
    expect(container.textContent).toContain("CAMPAIGN OVER");

    const menuBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "RETURN TO MENU",
    );
    expect(menuBtn).toBeDefined();

    const deleteSaveSpy = vi.spyOn(manager, "deleteSave");
    menuBtn?.click();

    expect(deleteSaveSpy).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalled();
  });
});