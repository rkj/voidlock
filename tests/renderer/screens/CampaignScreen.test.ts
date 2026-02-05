// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignScreen } from "@src/renderer/screens/CampaignScreen";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";

describe("CampaignScreen", () => {
  let container: HTMLElement;
  let manager: CampaignManager;
  let onNodeSelect: any;
  let onBack: any;
  let mockModalService: any;

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
    onBack = vi.fn();
    mockModalService = {
      alert: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(true),
    };

    // Mock HTMLCanvasElement.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      drawImage: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      setLineDash: vi.fn(),
    });
  });

  it("should render 'New Campaign' wizard when state is null", () => {
    const screen = new CampaignScreen(
      "screen-campaign",
      {
        campaignManager: manager,
        modalService: mockModalService,
        themeManager: {
          getColor: vi.fn().mockReturnValue("#000"),
          setTheme: vi.fn(),
          getCurrentThemeId: vi.fn().mockReturnValue("default"),
        },
      } as any,
      onNodeSelect,
      onBack,
    );
    screen.show();

    expect(container.textContent).toContain("NEW EXPEDITION");
    expect(container.querySelectorAll(".difficulty-card").length).toBe(4);
    expect(container.querySelector("#campaign-tactical-pause")).not.toBeNull();
  });

  it("should render Sector Map when campaign is active", () => {
    manager.startNewCampaign(12345, "normal");
    const screen = new CampaignScreen(
      "screen-campaign",
      {
        campaignManager: manager,
        modalService: mockModalService,
        themeManager: {
          getColor: vi.fn().mockReturnValue("#000"),
          setTheme: vi.fn(),
          getCurrentThemeId: vi.fn().mockReturnValue("default"),
        },
      } as any,
      onNodeSelect,
      onBack,
    );
    screen.show();

    // The 'Sector Map' header is now in the CampaignShell, but the screen itself renders nodes
    // expect(container.textContent).toContain("Sector Map");

    // Should find nodes
    const nodes = container.querySelectorAll(".campaign-node");
    expect(nodes.length).toBeGreaterThan(0);
  });

  it("should trigger onNodeSelect when an accessible node is clicked", () => {
    manager.startNewCampaign(12345, "normal");
    const screen = new CampaignScreen(
      "screen-campaign",
      {
        campaignManager: manager,
        modalService: mockModalService,
        themeManager: {
          getColor: vi.fn().mockReturnValue("#000"),
          setTheme: vi.fn(),
          getCurrentThemeId: vi.fn().mockReturnValue("default"),
        },
      } as any,
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

  it("should render a 'current' indicator on the current node", () => {
    manager.startNewCampaign(12345, "normal");
    const state = manager.getState()!;
    // Set a node as cleared and mark it as current
    state.nodes[0].status = "Cleared";
    state.currentNodeId = state.nodes[0].id;

    const screen = new CampaignScreen(
      "screen-campaign",
      {
        campaignManager: manager,
        modalService: mockModalService,
        themeManager: {
          getColor: vi.fn().mockReturnValue("#000"),
          setTheme: vi.fn(),
          getCurrentThemeId: vi.fn().mockReturnValue("default"),
        },
      } as any,
      onNodeSelect,
      onBack,
    );
    screen.show();

    const currentNode = container.querySelector(
      `.campaign-node[data-id="${state.currentNodeId}"]`,
    ) as HTMLElement;
    expect(currentNode).not.toBeNull();
    expect(currentNode.innerHTML).toContain("▼"); // Using downward triangle as indicator
  });

  it("should render its own back button in wizard footer", () => {
    const screen = new CampaignScreen(
      "screen-campaign",
      {
        campaignManager: manager,
        modalService: mockModalService,
        themeManager: {
          getColor: vi.fn().mockReturnValue("#000"),
          setTheme: vi.fn(),
          getCurrentThemeId: vi.fn().mockReturnValue("default"),
        },
      } as any,
      onNodeSelect,
      onBack,
    );
    screen.show();

    const backBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Back to Menu",
    );
    expect(backBtn).toBeDefined();
  });

  it("should render Defeat placeholder when campaign status is Defeat", () => {
    manager.startNewCampaign(12345, "extreme");
    const state = manager.getState()!;
    state.status = "Defeat";

    const screen = new CampaignScreen(
      "screen-campaign",
      {
        campaignManager: manager,
        modalService: mockModalService,
        themeManager: {
          getColor: vi.fn().mockReturnValue("#000"),
          setTheme: vi.fn(),
          getCurrentThemeId: vi.fn().mockReturnValue("default"),
        },
      } as any,
      onNodeSelect,
      onBack,
    );
    screen.show();

    expect(container.textContent).toContain("Campaign Defeat");
    expect(container.querySelector("#btn-defeat-summary")).not.toBeNull();
  });

  it("should render Victory placeholder when campaign status is Victory", () => {
    manager.startNewCampaign(12345, "normal");
    const state = manager.getState()!;
    state.status = "Victory";

    const screen = new CampaignScreen(
      "screen-campaign",
      {
        campaignManager: manager,
        modalService: mockModalService,
        themeManager: {
          getColor: vi.fn().mockReturnValue("#000"),
          setTheme: vi.fn(),
          getCurrentThemeId: vi.fn().mockReturnValue("default"),
        },
      } as any,
      onNodeSelect,
      onBack,
    );
    screen.show();

    expect(container.textContent).toContain("Campaign Victory");
    expect(container.querySelector("#btn-victory-summary")).not.toBeNull();
  });
});
