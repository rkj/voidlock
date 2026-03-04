import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import { CommandType, GameState, UnitState, CellType } from "@src/shared/types";
import { createMockGameState } from "@src/engine/tests/utils/MockFactory";

describe("Reproduction voidlock-7icmn: Pickup menu visibility", () => {
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
          { x: 5, y: 5, type: CellType.Floor, roomId: "room-2" },
        ],
        extraction: { x: 9, y: 9 },
      },
      units: [
        {
          id: "u1",
          pos: { x: 0.5, y: 0.5 },
          state: UnitState.Idle,
          stats: { speed: 20 },
        } as any,
      ],
      enemies: [],
      // Only 0,0 is visible
      visibleCells: ["0,0"],
      // 0,0 and 5,5 are discovered
      discoveredCells: ["0,0", "5,5"],
      objectives: [],
      loot: [],
      squadInventory: {},
      status: "Playing",
    });
  });

  it("should NOT show loot in discovered but NOT visible cell currently (FAILING TEST)", () => {
    // Loot at 5,5 (discovered but NOT visible)
    mockState.loot = [{ id: "loot-1", itemId: "medkit", pos: { x: 5.5, y: 5.5 } }];
    
    controller.handleMenuInput("4", mockState); // Pickup
    const renderState = controller.getRenderableState(mockState);
    const lootOption = renderState.options.find((o) =>
      o.label.includes("Pickup Medkit"),
    );
    
    // This is expected to FAIL currently because TargetOverlayGenerator uses isCellVisible
    expect(lootOption).toBeDefined();
  });

  it("should show loot in visible cell", () => {
    // Loot at 0,0 (visible)
    mockState.loot = [{ id: "loot-1", itemId: "medkit", pos: { x: 0.5, y: 0.5 } }];
    
    controller.handleMenuInput("4", mockState); // Pickup
    const renderState = controller.getRenderableState(mockState);
    const lootOption = renderState.options.find((o) =>
      o.label.includes("Pickup Medkit"),
    );
    
    expect(lootOption).toBeDefined();
  });

  it("should show objective in discovered but NOT visible cell currently", () => {
    // Objective at 5,5 (discovered but NOT visible)
    mockState.objectives = [{ 
        id: "obj-1", 
        kind: "Recover", 
        state: "Pending", 
        targetCell: { x: 5, y: 5 },
        visible: true // Set to true because it's discovered in MissionManager logic
    }];
    
    controller.handleMenuInput("4", mockState); // Pickup
    const renderState = controller.getRenderableState(mockState);
    const objOption = renderState.options.find((o) =>
      o.label.includes("Collect Objective"),
    );
    
    // This should work already because it uses obj.visible
    expect(objOption).toBeDefined();
  });
});
