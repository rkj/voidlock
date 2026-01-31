import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import { GameState, UnitState, CellType } from "@src/shared/types";
import { createMockGameState } from "@src/engine/tests/utils/MockFactory";

describe("Regression NTOD: Escort option for single unit", () => {
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
        ],
        extraction: { x: 5, y: 5 },
      },
      units: [
        {
          id: "u1",
          name: "Soldier 1",
          pos: { x: 0.5, y: 0.5 },
          state: UnitState.Idle,
          stats: { speed: 20 },
          archetype: "scout",
        } as any,
      ],
      enemies: [],
      visibleCells: ["0,0"],
      discoveredCells: ["0,0"],
      objectives: [],
      loot: [],
      squadInventory: {},
      status: "Playing",
    });
  });

  it("should disable Escort option in ORDERS_SELECT if only one unit is present", () => {
    controller.handleMenuInput("1", mockState); // Orders
    const renderState = controller.getRenderableState(mockState);
    const escortOption = renderState.options.find((o) =>
      o.label.includes("Escort"),
    );
    expect(escortOption).toBeDefined();
    expect(escortOption?.disabled).toBe(true);
  });

  it("should enable Escort option if a VIP is present even with one soldier", () => {
    mockState.units.push({
      id: "vip1",
      name: "VIP",
      pos: { x: 0.5, y: 0.5 },
      state: UnitState.Idle,
      stats: { speed: 10 },
      archetype: "vip",
    } as any);

    controller.handleMenuInput("1", mockState); // Orders
    const renderState = controller.getRenderableState(mockState);
    const escortOption = renderState.options.find((o) =>
      o.label.includes("Escort"),
    );
    expect(escortOption).toBeDefined();
    expect(escortOption?.disabled).toBe(false);
  });

  it("should filter out the target unit from available escorts in UNIT_SELECT", () => {
    mockState.units.push({
      id: "vip1",
      name: "VIP",
      pos: { x: 0.5, y: 0.5 },
      state: UnitState.Idle,
      stats: { speed: 10 },
      archetype: "vip",
    } as any);

    controller.handleMenuInput("1", mockState); // Orders
    controller.handleMenuInput("4", mockState); // Escort

    // Find VIP in Target Select
    let renderState = controller.getRenderableState(mockState);
    const vipTargetOption = renderState.options.find(o => o.label.includes("VIP"));
    expect(vipTargetOption).toBeDefined();
    
    controller.handleMenuInput(vipTargetOption!.key, mockState); // Select VIP as target

    // Now in UNIT_SELECT, VIP should NOT be an option to escort themselves
    renderState = controller.getRenderableState(mockState);
    expect(renderState.title).toBe("Select Unit(s)");
    
    const vipUnitOption = renderState.options.find(o => o.label.includes("VIP"));
    expect(vipUnitOption).toBeUndefined();

    const soldierUnitOption = renderState.options.find(o => o.label.includes("Soldier 1"));
    expect(soldierUnitOption).toBeDefined();
  });

  it("should not allow a soldier to escort themselves when two soldiers are present", () => {
    mockState.units.push({
      id: "u2",
      name: "Soldier 2",
      pos: { x: 0.5, y: 0.5 },
      state: UnitState.Idle,
      stats: { speed: 20 },
      archetype: "scout",
    } as any);

    controller.handleMenuInput("1", mockState); // Orders
    controller.handleMenuInput("4", mockState); // Escort

    // Select Soldier 1 as target
    let renderState = controller.getRenderableState(mockState);
    const s1TargetOption = renderState.options.find(o => o.label.includes("Soldier 1"));
    controller.handleMenuInput(s1TargetOption!.key, mockState);

    // Now in UNIT_SELECT, Soldier 1 should NOT be an option to escort themselves
    renderState = controller.getRenderableState(mockState);
    const s1UnitOption = renderState.options.find(o => o.label.includes("Soldier 1"));
    expect(s1UnitOption).toBeUndefined();

    const s2UnitOption = renderState.options.find(o => o.label.includes("Soldier 2"));
    expect(s2UnitOption).toBeDefined();
  });
});
