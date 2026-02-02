import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import { CellType, SquadConfig } from "@src/shared/types";

describe("State Snapshot Integrity", () => {
  it("should not reflect internal mutations in previously retrieved state", () => {
    const mockMap = {
      width: 3,
      height: 3,
      cells: [{ x: 0, y: 0, type: CellType.Floor }],
      spawnPoints: [],
    };
    const defaultSquad: SquadConfig = {
      soldiers: [{ archetypeId: "assault" }],
      inventory: {},
    };
    const engine = new CoreEngine(mockMap, 123, defaultSquad, false, false);

    const state1 = engine.getState();
    const unit1 = state1.units[0];
    const initialPosX = unit1.pos.x;

    // Replace internal state object (this is what managers do now to support structural sharing)
    // We use unknown to access private state for testing
    const internalState = (engine as any).state;
    const oldUnit = internalState.units[0];
    internalState.units[0] = {
      ...oldUnit,
      pos: { ...oldUnit.pos, x: oldUnit.pos.x + 10 },
    };

    const state2 = engine.getState();
    expect(state2.units[0].pos.x).toBe(initialPosX + 10);

    // The CRITICAL check: state1 should still have the old value
    expect(state1.units[0].pos.x).toBe(initialPosX);
  });
});
