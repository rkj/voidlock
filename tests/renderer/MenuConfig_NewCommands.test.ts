import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import { CommandType, GameState, UnitState, CellType } from "@src/shared/types";
import { createMockGameState } from "@src/engine/tests/utils/MockFactory";

describe("MenuConfig New Commands", () => {
  let controller: MenuController;
  let mockClient: any;
  let mockState: GameState;

  beforeEach(() => {
    mockClient = {
      sendCommand: vi.fn(),
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
          archetypeId: "vip",
          stats: { speed: 20 },
        } as any,
      ],
      enemies: [],
      visibleCells: ["0,0", "5,5"],
      discoveredCells: ["0,0", "5,5"],
      objectives: [],
      loot: [],
      squadInventory: {},
      status: "Playing",
    });
  });

  it("should have PICKUP in ACTION_SELECT", () => {
    const renderState = controller.getRenderableState(mockState);
    const pickupOption = renderState.options.find((o) =>
      o.label.includes("Pickup"),
    );
    expect(pickupOption).toBeDefined();
    expect(pickupOption?.key).toBe("4");
  });

  it("should have EXTRACT in ACTION_SELECT", () => {
    const renderState = controller.getRenderableState(mockState);
    const extractOption = renderState.options.find((o) =>
      o.label.includes("Extract"),
    );
    expect(extractOption).toBeDefined();
    expect(extractOption?.key).toBe("5");
  });

  it("should have ESCORT in ORDERS_SELECT", () => {
    controller.handleMenuInput("1", mockState); // Orders
    const renderState = controller.getRenderableState(mockState);
    const escortOption = renderState.options.find((o) =>
      o.label.includes("Escort"),
    );
    expect(escortOption).toBeDefined();
    expect(escortOption?.key).toBe("4");
  });

  it("should have HOLD as key 5 in ORDERS_SELECT", () => {
    controller.handleMenuInput("1", mockState); // Orders
    const renderState = controller.getRenderableState(mockState);
    const holdOption = renderState.options.find((o) =>
      o.label.includes("Hold"),
    );
    expect(holdOption).toBeDefined();
    expect(holdOption?.key).toBe("5");
  });

  it("should transition to TARGET_SELECT for PICKUP", () => {
    controller.handleMenuInput("4", mockState); // Pickup
    expect(controller.menuState).toBe("TARGET_SELECT");
  });

  it("should transition to UNIT_SELECT for EXTRACT", () => {
    controller.handleMenuInput("5", mockState); // Extract
    expect(controller.menuState).toBe("UNIT_SELECT");
  });

  it("should transition to TARGET_SELECT for ESCORT", () => {
    controller.handleMenuInput("1", mockState); // Orders
    controller.handleMenuInput("4", mockState); // Escort
    expect(controller.menuState).toBe("TARGET_SELECT");
  });

  it("should send EXTRACT command correctly", () => {
    controller.handleMenuInput("5", mockState); // Extract
    controller.handleMenuInput("1", mockState); // Unit u1

    expect(mockClient.sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CommandType.EXTRACT,
        unitIds: ["u1"],
      }),
    );
  });

  it("should show loot in TARGET_SELECT for PICKUP", () => {
    mockState.loot = [{ id: "loot-1", itemId: "medkit", pos: { x: 5, y: 5 } }];
    controller.handleMenuInput("4", mockState); // Pickup

    const renderState = controller.getRenderableState(mockState);
    const lootOption = renderState.options.find((o) =>
      o.label.includes("Pickup Medkit"),
    );
    expect(lootOption).toBeDefined();
  });

  it("should show friendly units in TARGET_SELECT for ESCORT", () => {
    controller.handleMenuInput("1", mockState); // Orders
    controller.handleMenuInput("4", mockState); // Escort

    const renderState = controller.getRenderableState(mockState);
    const unitOption = renderState.options.find((o) => o.label.includes("u2"));
    expect(unitOption).toBeDefined();
  });

  it("should send PICKUP command with lootId", () => {
    mockState.loot = [{ id: "loot-1", itemId: "medkit", pos: { x: 5, y: 5 } }];
    controller.handleMenuInput("4", mockState); // Pickup

    // Find key for loot-1
    const renderState = controller.getRenderableState(mockState);
    const lootOption = renderState.options.find((o) =>
      o.label.includes("Pickup Medkit"),
    );
    const key = lootOption?.key || "1";

    controller.handleMenuInput(key, mockState); // Target loot-1
    controller.handleMenuInput("1", mockState); // Unit u1

    expect(mockClient.sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CommandType.PICKUP,
        unitIds: ["u1"],
        lootId: "loot-1",
      }),
    );
  });

  it("should send ESCORT_UNIT command with targetId", () => {
    controller.handleMenuInput("1", mockState); // Orders
    controller.handleMenuInput("4", mockState); // Escort

    // Find key for Unit u2
    const renderState = controller.getRenderableState(mockState);
    const unitOption = renderState.options.find((o) => o.label.includes("u2"));
    const key = unitOption?.key || "2";

    controller.handleMenuInput(key, mockState); // Target u2
    controller.handleMenuInput("1", mockState); // Unit u1 (Escort)

    expect(mockClient.sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CommandType.ESCORT_UNIT,
        unitIds: ["u1"],
        targetId: "u2",
      }),
    );
  });
});
