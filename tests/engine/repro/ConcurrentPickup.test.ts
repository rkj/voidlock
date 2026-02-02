import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import { UnitState, CommandType } from "@src/shared/types";
import { createMockGameState } from "@src/engine/tests/utils/MockFactory";

describe("Concurrent Pickup Regression", () => {
  it("should cancel channeling for the second unit when the first unit picks up the item", () => {
    const mockState = createMockGameState({
      map: {
        width: 10,
        height: 10,
        cells: [],
        spawnPoints: [],
      },
      loot: [{ id: "loot-1", itemId: "medkit", pos: { x: 5, y: 5 } }],
      mines: [],
      turrets: [],
      units: [
        {
          id: "u1",
          pos: { x: 5, y: 5 },
          state: UnitState.Idle,
          stats: { speed: 20 },
        } as any,
        {
          id: "u2",
          pos: { x: 5, y: 5 },
          state: UnitState.Idle,
          stats: { speed: 20 },
        } as any,
      ],
    });

    const engine = new CoreEngine(
      mockState.map,
      123,
      { soldiers: [], inventory: {} },
      false,
      false,
    );
    // @ts-ignore
    engine.state = mockState;

    // Issue PICKUP command to both units
    const cmd1 = {
      type: CommandType.PICKUP,
      unitIds: ["u1"],
      lootId: "loot-1",
      label: "Pickup",
    };
    const cmd2 = {
      type: CommandType.PICKUP,
      unitIds: ["u2"],
      lootId: "loot-1",
      label: "Pickup",
    };

    engine.applyCommand(cmd1 as any);
    engine.applyCommand(cmd2 as any);

    // Update to start channeling
    engine.update(100);

    const u1 = engine.getState().units.find((u) => u.id === "u1")!;
    const u2 = engine.getState().units.find((u) => u.id === "u2")!;

    expect(u1.state).toBe(UnitState.Channeling);
    expect(u2.state).toBe(UnitState.Channeling);

    // Fast forward enough for ONE to finish (assuming same speed, they finish same tick)
    // But let's say u1 updates first and finishes.
    // Base pickup time is usually related to speed.
    // Let's assume 3000ms.
    engine.update(5000);

    const state = engine.getState();
    const u1After = state.units.find((u) => u.id === "u1")!;
    const u2After = state.units.find((u) => u.id === "u2")!;

    // One should have finished (Idle) and item gone.
    // The other should ALSO be Idle because item is gone.
    expect(state.loot.length).toBe(0);
    expect(u1After.state).toBe(UnitState.Idle);

    // This is the failure condition: u2 might still be Channeling or have finished "successfully" (phantom pickup)
    expect(u2After.state).toBe(UnitState.Idle);

    // Inventory should have 1 item, not 2
    expect(state.squadInventory["medkit"]).toBe(1);
  });
});
