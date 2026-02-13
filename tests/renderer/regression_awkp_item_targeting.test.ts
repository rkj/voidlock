import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import { CommandType, GameState, UnitState, MissionType } from "@src/shared/types";

describe("Regression awkp: Item Targeting Logic", () => {
  let controller: MenuController;
  let mockClient: any;
  let mockState: GameState;

  beforeEach(() => {
    mockClient = {
      applyCommand: vi.fn(),
    };
    controller = new MenuController(mockClient);
    mockState = {
      t: 1000,
      seed: 123,
      missionType: MissionType.Default,
      map: { width: 10, height: 10, cells: [] },
      units: [
        { id: "u1", pos: { x: 0.5, y: 0.5 }, state: UnitState.Idle } as any,
      ],
      enemies: [],
      visibleCells: ["0,0", "5,5"], // u1 at 0,0 sees 0,0
      discoveredCells: [],
      objectives: [],
      loot: [],
      mines: [],
      turrets: [],
      stats: {} as any,
      status: "Playing",
      settings: {} as any,
      squadInventory: {
        frag_grenade: 1,
        medkit: 1,
      },
    };
  });

  it("Grenade: should be disabled in ITEM_SELECT if no enemies are visible", () => {
    controller.handleMenuInput("3", mockState); // USE ITEM
    const renderState = controller.getRenderableState(mockState);
    const grenadeOption = renderState.options.find((o) =>
      o.label.includes("Frag Grenade"),
    );
    expect(grenadeOption?.disabled).toBe(true);
  });

  it("Grenade: should be enabled in ITEM_SELECT if enemies are visible", () => {
    mockState.enemies = [
      { id: "e1", pos: { x: 5.5, y: 5.5 }, type: "xeno-mite" } as any,
    ];
    // 5,5 is visible
    controller.handleMenuInput("3", mockState); // USE ITEM
    const renderState = controller.getRenderableState(mockState);
    const grenadeOption = renderState.options.find((o) =>
      o.label.includes("Frag Grenade"),
    );
    expect(grenadeOption?.disabled).toBe(false);
  });

  it("Grenade: should target HOSTILE_UNIT when selected", () => {
    mockState.enemies = [
      { id: "e1", pos: { x: 5.5, y: 5.5 }, type: "Xeno-Mite" } as any,
    ];
    controller.handleMenuInput("3", mockState); // USE ITEM
    controller.handleMenuInput("1", mockState); // Select Grenade

    expect(controller.menuState).toBe("TARGET_SELECT");
    const renderState = controller.getRenderableState(mockState);

    const enemyOption = renderState.options.find((o) =>
      o.label.includes("Xeno-Mite"),
    );
    expect(enemyOption).toBeDefined();

    const roomOption = renderState.options.find((o) =>
      o.label.includes("Room"),
    );
    expect(roomOption).toBeUndefined();
  });

  it("Medkit: should transition to UNIT_SELECT when selected", () => {
    controller.handleMenuInput("3", mockState); // USE ITEM
    controller.handleMenuInput("2", mockState); // Select Medkit (item 2)

    expect(controller.menuState).toBe("UNIT_SELECT");
  });

  it("Medkit: selecting a unit should execute and reset", () => {
    controller.handleMenuInput("3", mockState); // USE ITEM
    controller.handleMenuInput("2", mockState); // Select Medkit

    const renderState = controller.getRenderableState(mockState);
    const unit1Option = renderState.options.find((o) =>
      o.label.includes("u1"),
    )!;

    controller.handleMenuInput(unit1Option.key, mockState);

    // It should now use selected unitIds for self-heal
    expect(mockClient.applyCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CommandType.USE_ITEM,
        itemId: "medkit",
        unitIds: ["u1"],
      }),
    );
    expect(controller.menuState).toBe("ACTION_SELECT");
  });
});
