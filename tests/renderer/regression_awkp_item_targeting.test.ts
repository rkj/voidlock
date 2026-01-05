import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import {
  CommandType,
  GameState,
  UnitState,
  EnemyType,
  ItemLibrary,
} from "@src/shared/types";
import { createMockGameState } from "@src/engine/tests/utils/MockFactory";

describe("Regression awkp: Item Targeting Logic", () => {
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
      map: { width: 10, height: 10, cells: [] },
      units: [
        { id: "u1", state: UnitState.Idle, pos: { x: 1, y: 1 } } as any,
        { id: "u2", state: UnitState.Idle, pos: { x: 2, y: 2 } } as any,
      ],
      enemies: [
        {
          id: "e1",
          type: EnemyType.XenoMite,
          pos: { x: 8, y: 8 },
          hp: 10,
          maxHp: 10,
        } as any,
      ],
      visibleCells: [],
      discoveredCells: ["1,1", "2,2", "8,8"],
      objectives: [],
      squadInventory: { frag_grenade: 1, medkit: 1 },
      status: "Playing",
    });
  });

  it("Grenade: should be disabled in ITEM_SELECT if no enemies are visible", () => {
    mockState.visibleCells = ["1,1"]; // Enemy e1 at 8,8 is NOT visible

    controller.handleMenuInput("3", mockState); // USE ITEM
    expect(controller.menuState).toBe("ITEM_SELECT");

    const renderState = controller.getRenderableState(mockState);
    const grenadeOption = renderState.options.find((o) =>
      o.label.includes("Frag Grenade"),
    );
    expect(grenadeOption?.disabled).toBe(true);
  });

  it("Grenade: should be enabled in ITEM_SELECT if enemies are visible", () => {
    mockState.visibleCells = ["8,8"]; // Enemy e1 at 8,8 IS visible

    controller.handleMenuInput("3", mockState); // USE ITEM
    expect(controller.menuState).toBe("ITEM_SELECT");

    const renderState = controller.getRenderableState(mockState);
    const grenadeOption = renderState.options.find((o) =>
      o.label.includes("Frag Grenade"),
    );
    expect(grenadeOption?.disabled).toBe(false);
  });

  it("Grenade: should target VISIBLE_ENEMY when selected", () => {
    mockState.visibleCells = ["8,8"];

    controller.handleMenuInput("3", mockState); // USE ITEM
    // Find Grenade option index (it might be 1 or 2 depending on alphabetical order of inventory keys, but usually it's stable)
    const items = Object.entries(mockState.squadInventory).filter(
      ([_, count]) => count > 0,
    );
    const grenadeIdx = items.findIndex(([id]) => id === "frag_grenade") + 1;

    controller.handleMenuInput(grenadeIdx.toString(), mockState);

    expect(controller.menuState).toBe("TARGET_SELECT");
    const renderState = controller.getRenderableState(mockState);

    // Should show enemy as target
    const enemyOption = renderState.options.find((o) =>
      o.label.includes(EnemyType.XenoMite),
    );
    expect(enemyOption).toBeDefined();
    // Should NOT show generic cells/rooms (unless we want to allow that too, but spec says "Target Visible Enemies ONLY")
    const roomOption = renderState.options.find((o) =>
      o.label.includes("Room"),
    );
    expect(roomOption).toBeUndefined();
  });

  it("Medkit: should target FRIENDLY_UNIT when selected", () => {
    controller.handleMenuInput("3", mockState); // USE ITEM
    const items = Object.entries(mockState.squadInventory).filter(
      ([_, count]) => count > 0,
    );
    const medkitIdx = items.findIndex(([id]) => id === "medkit") + 1;

    controller.handleMenuInput(medkitIdx.toString(), mockState);

    expect(controller.menuState).toBe("TARGET_SELECT");
    const renderState = controller.getRenderableState(mockState);

    // Should show friendly units as targets
    const unit1Option = renderState.options.find((o) =>
      o.label.includes("Unit u1"),
    );
    const unit2Option = renderState.options.find((o) =>
      o.label.includes("Unit u2"),
    );
    expect(unit1Option).toBeDefined();
    expect(unit2Option).toBeDefined();

    // Should NOT show generic cells/rooms
    const roomOption = renderState.options.find((o) =>
      o.label.includes("Room"),
    );
    expect(roomOption).toBeUndefined();
  });

  it("Medkit: selecting a unit target should set pendingTargetId and move to UNIT_SELECT", () => {
    controller.handleMenuInput("3", mockState); // USE ITEM
    const items = Object.entries(mockState.squadInventory).filter(
      ([_, count]) => count > 0,
    );
    const medkitIdx = items.findIndex(([id]) => id === "medkit") + 1;
    controller.handleMenuInput(medkitIdx.toString(), mockState);

    const renderState = controller.getRenderableState(mockState);
    const unit1Option = renderState.options.find((o) =>
      o.label.includes("Unit u1"),
    )!;

    controller.handleMenuInput(unit1Option.key, mockState);

    expect(controller.menuState).toBe("UNIT_SELECT");
    expect(controller.pendingTargetId).toBe("u1");
  });
});
