// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignScreen } from "@src/renderer/screens/CampaignScreen";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";

describe("CampaignScreen Bonus Loot Pips", () => {
  let container: HTMLElement;
  let manager: CampaignManager;
  let onNodeSelect: any;
  let onBarracks: any;
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
    onBarracks = vi.fn();
    onBack = vi.fn();
    mockModalService = {
      alert: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(true),
    };
  });

  it("should render loot pips for Simulation difficulty", () => {
    manager.startNewCampaign(12345, "simulation");
    const state = manager.getState()!;
    // Force bonusLootCount on the first node
    state.nodes[0].bonusLootCount = 3;

    const screen = new CampaignScreen(
      "screen-campaign",
      manager,
      mockModalService,
      onNodeSelect,
      onBarracks,
      onBack,
    );
    screen.show();

    const nodeEl = container.querySelector(`[data-id="${state.nodes[0].id}"]`);
    expect(nodeEl).not.toBeNull();

    // Check for pips. We expect 3 stars or dots.
    // Based on the task: "Draw X 'Star' pips (or dots) next to the node icon"
    const pips = nodeEl?.querySelectorAll(".loot-pip");
    expect(pips?.length).toBe(3);
  });

  it("should render loot pips for Clone difficulty", () => {
    manager.startNewCampaign(12345, "clone");
    const state = manager.getState()!;
    state.nodes[0].bonusLootCount = 2;

    const screen = new CampaignScreen(
      "screen-campaign",
      manager,
      mockModalService,
      onNodeSelect,
      onBarracks,
      onBack,
    );
    screen.show();

    const nodeEl = container.querySelector(`[data-id="${state.nodes[0].id}"]`);
    const pips = nodeEl?.querySelectorAll(".loot-pip");
    expect(pips?.length).toBe(2);
  });

  it("should NOT render loot pips for Standard difficulty", () => {
    manager.startNewCampaign(12345, "standard");
    const state = manager.getState()!;
    state.nodes[0].bonusLootCount = 3;

    const screen = new CampaignScreen(
      "screen-campaign",
      manager,
      mockModalService,
      onNodeSelect,
      onBarracks,
      onBack,
    );
    screen.show();

    const nodeEl = container.querySelector(`[data-id="${state.nodes[0].id}"]`);
    const pips = nodeEl?.querySelectorAll(".loot-pip");
    expect(pips?.length).toBe(0);
  });

  it("should NOT render loot pips for Ironman difficulty", () => {
    manager.startNewCampaign(12345, "ironman");
    const state = manager.getState()!;
    state.nodes[0].bonusLootCount = 3;

    const screen = new CampaignScreen(
      "screen-campaign",
      manager,
      mockModalService,
      onNodeSelect,
      onBarracks,
      onBack,
    );
    screen.show();

    const nodeEl = container.querySelector(`[data-id="${state.nodes[0].id}"]`);
    const pips = nodeEl?.querySelectorAll(".loot-pip");
    expect(pips?.length).toBe(0);
  });
});
