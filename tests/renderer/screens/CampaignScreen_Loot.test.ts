// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignScreen } from "@src/renderer/screens/CampaignScreen";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";

describe("CampaignScreen Bonus Loot Pips", () => {
  let container: HTMLElement;
  let manager: CampaignManager;
  let onNodeSelect: any;
  let onBack: any;
  let mockModalService: any;
  let mockTheme: any;
  let mockInput: any;

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
    mockTheme = {
      getAssetUrl: vi.fn().mockReturnValue("mock-url"),
      getColor: vi.fn().mockReturnValue("#ffffff"),
      getCurrentThemeId: vi.fn().mockReturnValue("default"),
    };
    mockInput = {
      pushContext: vi.fn(),
      popContext: vi.fn(),
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

  it("should render loot pips for Simulation difficulty", () => {
    manager.startNewCampaign(12345, "simulation");
    const state = manager.getState()!;
    state.nodes[0].bonusLootCount = 3;

    const screen = new CampaignScreen({
      containerId: "screen-campaign",
      campaignManager: manager,
      themeManager: mockTheme as any,
      inputDispatcher: mockInput as any,
      modalService: mockModalService as any,
      onNodeSelect: onNodeSelect,
      onMainMenu: onBack
    });
    screen.show();

    const nodeEl = container.querySelector(`[data-id="${state.nodes[0].id}"]`);
    expect(nodeEl).not.toBeNull();

    const pips = nodeEl?.querySelectorAll(".loot-pip");
    expect(pips?.length).toBe(3);
  });

  it("should render loot pips for Clone difficulty", () => {
    manager.startNewCampaign(12345, "clone");
    const state = manager.getState()!;
    state.nodes[0].bonusLootCount = 2;

    const screen = new CampaignScreen({
      containerId: "screen-campaign",
      campaignManager: manager,
      themeManager: mockTheme as any,
      inputDispatcher: mockInput as any,
      modalService: mockModalService as any,
      onNodeSelect: onNodeSelect,
      onMainMenu: onBack
    });
    screen.show();

    const nodeEl = container.querySelector(`[data-id="${state.nodes[0].id}"]`);
    const pips = nodeEl?.querySelectorAll(".loot-pip");
    expect(pips?.length).toBe(2);
  });

  it("should NOT render loot pips for Standard difficulty", () => {
    manager.startNewCampaign(12345, "standard");
    const state = manager.getState()!;
    state.nodes[0].bonusLootCount = 3;

    const screen = new CampaignScreen({
      containerId: "screen-campaign",
      campaignManager: manager,
      themeManager: mockTheme as any,
      inputDispatcher: mockInput as any,
      modalService: mockModalService as any,
      onNodeSelect: onNodeSelect,
      onMainMenu: onBack
    });
    screen.show();

    const nodeEl = container.querySelector(`[data-id="${state.nodes[0].id}"]`);
    const pips = nodeEl?.querySelectorAll(".loot-pip");
    expect(pips?.length).toBe(0);
  });

  it("should NOT render loot pips for Ironman difficulty", () => {
    manager.startNewCampaign(12345, "ironman");
    const state = manager.getState()!;
    state.nodes[0].bonusLootCount = 3;

    const screen = new CampaignScreen({
      containerId: "screen-campaign",
      campaignManager: manager,
      themeManager: mockTheme as any,
      inputDispatcher: mockInput as any,
      modalService: mockModalService as any,
      onNodeSelect: onNodeSelect,
      onMainMenu: onBack
    });
    screen.show();

    const nodeEl = container.querySelector(`[data-id="${state.nodes[0].id}"]`);
    const pips = nodeEl?.querySelectorAll(".loot-pip");
    expect(pips?.length).toBe(0);
  });
});
