import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import { GameState, UnitState } from "@src/shared/types";
import { createMockGameState } from "@src/engine/tests/utils/MockFactory";

describe("MenuController Context Awareness", () => {
  let controller: MenuController;
  let mockClient: any;
  let mockState: GameState;

  beforeEach(() => {
    mockClient = {
      applyCommand: vi.fn(),
    };
    controller = new MenuController(mockClient);
    mockState = createMockGameState({
      t: 1000,
      map: { width: 10, height: 10, cells: [] },
      units: [{ id: "u1", state: UnitState.Idle } as any],
      enemies: [],
      visibleCells: [],
      discoveredCells: [],
      objectives: [],
      stats: {
        threatLevel: 0,
        aliensKilled: 0,
        elitesKilled: 0,
        casualties: 0,
        scrapGained: 0,
      },
      status: "Playing",
    });
  });

  it("should disable USE ITEM when inventory is empty", () => {
    mockState.squadInventory = {};
    const renderState = controller.getRenderableState(mockState);
    const useItemOption = renderState.options.find((o) =>
      o.label.includes("USE ITEM"),
    );
    expect(useItemOption?.disabled).toBe(true);
  });

  it("should enable USE ITEM when inventory has items", () => {
    mockState.squadInventory = { medkit: 1 };
    const renderState = controller.getRenderableState(mockState);
    const useItemOption = renderState.options.find((o) =>
      o.label.includes("USE ITEM"),
    );
    expect(useItemOption?.disabled).toBeFalsy();
  });

  it("should show extraction point in target select when discovered", () => {
    mockState.map.extraction = { x: 5, y: 5 };
    mockState.discoveredCells = ["5,5"];

    // Navigate to MOVE TO ROOM
    controller.handleMenuInput("1", mockState); // ORDERS
    controller.handleMenuInput("1", mockState); // MOVE TO ROOM

    expect(controller.menuState).toBe("TARGET_SELECT");
    const renderState = controller.getRenderableState(mockState);
    const extractOption = renderState.options.find((o) =>
      o.label.includes("EXTRACTION"),
    );
    expect(extractOption).toBeDefined();
  });

  it("should NOT show extraction point in target select when NOT discovered", () => {
    mockState.map.extraction = { x: 5, y: 5 };
    mockState.discoveredCells = ["0,0"];

    // Navigate to MOVE TO ROOM
    controller.handleMenuInput("1", mockState); // ORDERS
    controller.handleMenuInput("1", mockState); // MOVE TO ROOM

    const renderState = controller.getRenderableState(mockState);
    const extractOption = renderState.options.find((o) =>
      o.label.includes("EXTRACTION"),
    );
    expect(extractOption).toBeUndefined();
  });
});
