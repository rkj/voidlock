import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import { CommandType, GameState, UnitState } from "@src/shared/types";
import { createMockGameState } from "@src/engine/tests/utils/MockFactory";

describe("Regression voidlock-3dpu: Scanner UI Targeting", () => {
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
      units: [
        { id: "u1", state: UnitState.Idle, pos: { x: 1, y: 1 } } as any,
        { id: "u2", state: UnitState.Idle, pos: { x: 2, y: 2 } } as any,
      ],
      enemies: [],
      visibleCells: ["1,1", "2,2"],
      discoveredCells: ["1,1", "2,2"],
      objectives: [],
      squadInventory: { scanner: 1 },
      status: "Playing",
    });
  });

  it("Scanner: should target FRIENDLY_UNIT when selected", () => {
    controller.handleMenuInput("3", mockState); // USE ITEM
    expect(controller.menuState).toBe("ITEM_SELECT");

    controller.handleMenuInput("1", mockState); // Select Scanner (first item)

    expect(controller.menuState).toBe("TARGET_SELECT");
    const renderState = controller.getRenderableState(mockState);

    // Should show friendly units as targets (u1, u2)
    const unit1Option = renderState.options.find((o) => o.label.includes("u1"));
    const unit2Option = renderState.options.find((o) => o.label.includes("u2"));
    expect(unit1Option).toBeDefined();
    expect(unit2Option).toBeDefined();

    // Should NOT show generic Room cells as targets
    const roomOption = renderState.options.find((o) =>
      o.label.includes("ROOM"),
    );
    expect(roomOption).toBeUndefined();
  });

  it("Scanner: selecting a unit target should execute immediately with targetUnitId", () => {
    controller.handleMenuInput("3", mockState); // USE ITEM
    controller.handleMenuInput("1", mockState); // Select Scanner

    const renderState = controller.getRenderableState(mockState);
    const unit1Option = renderState.options.find((o) =>
      o.label.includes("u1"),
    )!;

    controller.handleMenuInput(unit1Option.key, mockState);

    expect(mockClient.applyCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CommandType.USE_ITEM,
        itemId: "scanner",
        targetUnitId: "u1",
        unitIds: [], // Global commander ability
      }),
    );
    expect(controller.menuState).toBe("ACTION_SELECT");
  });

  it("Scanner: clicking on a unit on canvas should target that unit", () => {
    controller.handleMenuInput("3", mockState); // USE ITEM
    controller.handleMenuInput("1", mockState); // Select Scanner

    // Click on cell 2,2 where u2 is located
    controller.handleCanvasClick({ x: 2, y: 2 }, mockState);

    expect(mockClient.applyCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CommandType.USE_ITEM,
        itemId: "scanner",
        targetUnitId: "u2",
        unitIds: [],
      }),
    );
    expect(controller.menuState).toBe("ACTION_SELECT");
  });
});
