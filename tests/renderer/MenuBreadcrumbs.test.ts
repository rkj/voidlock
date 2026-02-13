import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import { MenuRenderer } from "@src/renderer/ui/MenuRenderer";
import { GameState, UnitState, MissionType } from "@src/shared/types";

describe("Menu Breadcrumbs", () => {
  let controller: MenuController;
  let mockClient: any;
  const mockState: GameState = {
    t: 1000,
    seed: 12345,
    missionType: MissionType.Default,
    map: { width: 10, height: 10, cells: [] },
    units: [
      { id: "u1", pos: { x: 0.5, y: 0.5 }, state: UnitState.Idle } as any,
    ],
    enemies: [],
    visibleCells: [],
    discoveredCells: [],
    objectives: [],
    loot: [],
    mines: [],
    turrets: [],
    stats: {
      threatLevel: 0,
      aliensKilled: 0,
      elitesKilled: 0,
      casualties: 0,
      scrapGained: 0,
    },
    status: "Playing",
    settings: {
      mode: "Simulation" as any,
      debugOverlayEnabled: false,
      debugSnapshots: false,
      losOverlayEnabled: false,
      timeScale: 1.0,
      isPaused: false,
      isSlowMotion: false,
      allowTacticalPause: true,
    },
    squadInventory: { medkit: 1 },
  };

  beforeEach(() => {
    mockClient = {
      applyCommand: vi.fn(),
    };
    controller = new MenuController(mockClient);
  });

  it("should have no breadcrumbs at ACTION_SELECT", () => {
    const state = controller.getRenderableState(mockState);
    expect(state.breadcrumbs).toEqual([]);
  });

  it("should have 'Orders' breadcrumb in ORDERS_SELECT", () => {
    controller.handleMenuInput("1", mockState); // Select Orders
    const state = controller.getRenderableState(mockState);
    expect(state.breadcrumbs).toEqual(["Orders"]);
  });

  it("should have 'Orders > Move to Room' breadcrumb in TARGET_SELECT", () => {
    controller.handleMenuInput("1", mockState); // Orders
    controller.handleMenuInput("1", mockState); // Move to Room
    const state = controller.getRenderableState(mockState);
    expect(state.breadcrumbs).toEqual(["Orders", "Move To Room"]);
  });

  it("should have 'Engagement > Engage (Stop and Shoot)' breadcrumb in UNIT_SELECT", () => {
    controller.handleMenuInput("2", mockState); // Engagement
    controller.handleMenuInput("1", mockState); // Engage
    const state = controller.getRenderableState(mockState);
    expect(state.breadcrumbs).toEqual([
      "Engagement",
      "Engage (Stop And Shoot)",
    ]);
  });

  it("should pop breadcrumbs when going back", () => {
    controller.handleMenuInput("1", mockState); // Orders
    controller.handleMenuInput("1", mockState); // Move to Room
    controller.goBack();
    const state = controller.getRenderableState(mockState);
    expect(state.breadcrumbs).toEqual(["Orders"]);
    controller.goBack();
    const state2 = controller.getRenderableState(mockState);
    expect(state2.breadcrumbs).toEqual([]);
  });

  it("should render breadcrumbs in HTML", () => {
    controller.handleMenuInput("1", mockState); // Orders
    controller.handleMenuInput("1", mockState); // Move to Room
    const state = controller.getRenderableState(mockState);
    const html = MenuRenderer.renderMenu(state);
    expect(html).toContain(
      '<div class="menu-breadcrumbs">Orders &gt; Move To Room</div>',
    );
  });

  it("should show item name in breadcrumbs for ITEM_SELECT", () => {
    controller.handleMenuInput("3", mockState); // Use Item
    controller.handleMenuInput("1", mockState); // Medkit
    const state = controller.getRenderableState(mockState);
    expect(state.breadcrumbs).toEqual(["Use Item", "Medkit"]);
  });
});
