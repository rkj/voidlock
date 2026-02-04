import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import { GameState, UnitState, CellType } from "@src/shared/types";
import { createMockGameState } from "@src/engine/tests/utils/MockFactory";

describe("Regression voidlock-peb3: Restrict PICKUP to single unit", () => {
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
      map: {
        width: 10,
        height: 10,
        cells: [
          { x: 0, y: 0, type: CellType.Floor, roomId: "room-1" },
          { x: 1, y: 1, type: CellType.Floor, roomId: "room-2" },
        ],
        extraction: { x: 5, y: 5 },
      },
      units: [
        {
          id: "u1",
          pos: { x: 0.5, y: 0.5 },
          state: UnitState.Idle,
          stats: { speed: 20 },
        } as any,
        {
          id: "u2",
          pos: { x: 0.5, y: 0.5 },
          state: UnitState.Idle,
          stats: { speed: 20 },
        } as any,
      ],
      enemies: [],
      visibleCells: ["0,0", "5,5"],
      discoveredCells: ["0,0", "5,5"],
      objectives: [],
      loot: [{ id: "loot-1", itemId: "medkit", pos: { x: 5, y: 5 } }],
      squadInventory: {},
      status: "Playing",
    });
  });

  it("should NOT show 'All Units' option when in UNIT_SELECT for PICKUP", () => {
    controller.handleMenuInput("4", mockState); // Pickup

    // Find key for loot-1
    const targetState = controller.getRenderableState(mockState);
    const lootOption = targetState.options.find((o) =>
      o.label.includes("Pickup Medkit"),
    );
    const key = lootOption?.key || "1";

    controller.handleMenuInput(key, mockState); // Select target loot-1

    expect(controller.menuState).toBe("UNIT_SELECT");

    const renderState = controller.getRenderableState(mockState);
    const allUnitsOption = renderState.options.find((o) =>
      o.label.includes("All Units"),
    );

    expect(allUnitsOption).toBeUndefined();
  });

  it("should NOT execute PICKUP for all units if requested via key", () => {
    controller.handleMenuInput("4", mockState); // Pickup

    const targetState = controller.getRenderableState(mockState);
    const lootOption = targetState.options.find((o) =>
      o.label.includes("Pickup Medkit"),
    );
    const targetKey = lootOption?.key || "1";

    controller.handleMenuInput(targetKey, mockState); // Select target loot-1

    const allUnitsKey = (mockState.units.length + 1).toString();

    // Attempt to select 'All Units'
    controller.handleMenuInput(allUnitsKey, mockState);

    expect(mockClient.applyCommand).not.toHaveBeenCalled();
    // It should ideally stay in UNIT_SELECT or show an error,
    // but the task is to disable/hide it.
  });
});
