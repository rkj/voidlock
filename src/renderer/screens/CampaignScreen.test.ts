// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignScreen } from "./CampaignScreen";
import { CampaignManager } from "../campaign/CampaignManager";
import { CampaignNode } from "../../shared/campaign_types";

describe("CampaignScreen", () => {
  let container: HTMLElement;
  let manager: CampaignManager;
  let onNodeSelect: any;
  let onBack: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-campaign"></div>';
    container = document.getElementById("screen-campaign")!;

    manager = new CampaignManager();
    onNodeSelect = vi.fn();
    onBack = vi.fn();
  });

  it("should render 'No Active Campaign' when state is null", () => {
    const screen = new CampaignScreen(
      "screen-campaign",
      manager,
      onNodeSelect,
      onBack,
    );
    screen.show();

    expect(container.textContent).toContain("NO ACTIVE CAMPAIGN");
  });

  it("should render Sector Map when campaign is active", () => {
    manager.startNewCampaign(12345, "normal");
    const screen = new CampaignScreen(
      "screen-campaign",
      manager,
      onNodeSelect,
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

  it("should trigger onBack when back button is clicked", () => {
    const screen = new CampaignScreen(
      "screen-campaign",
      manager,
      onNodeSelect,
      onBack,
    );
    screen.show();

    const backBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "BACK TO MENU",
    );
    backBtn?.click();

    expect(onBack).toHaveBeenCalled();
  });
});
