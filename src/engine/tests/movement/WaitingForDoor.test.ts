import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../../CoreEngine";
import {
  CellType,
  UnitState,
  MapDefinition,
  SquadConfig,
  CommandType,
} from "../../../shared/types";

describe("Unit WaitingForDoor State", () => {
  let engine: CoreEngine;
  let map: MapDefinition;

  beforeEach(() => {
    // 2x1 map with a closed door between them
    map = {
      width: 2,
      height: 1,
      cells: [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 1, y: 0, type: CellType.Floor }, // West wall open conceptually, blocked by door
      ],
      doors: [
        {
          id: "d1",
          segment: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
          ],
          orientation: "Vertical",
          state: "Closed",
          hp: 100,
          maxHp: 100,
          openDuration: 1,
        },
      ],
      spawnPoints: [],
      objectives: [],
    };

    const squad: SquadConfig = { soldiers: [], inventory: {} };
    engine = new CoreEngine(map, 123, squad, false, false);
    engine.clearUnits();
  });

  it("should set state to WaitingForDoor when blocked by a closed door", () => {
    // Spawn unit at 0,0
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 500,
      accuracy: 1000,
      attackRange: 2,
      sightRange: 10,
      speed: 2,
      commandQueue: [],
      archetypeId: "assault",
    });

    // Order move to 1,0
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ["u1"],
      target: { x: 1, y: 0 },
    });

    // Run update
    // Distance 0.5 to 1.5 is 1.0. Speed 2 tiles/sec.
    // 100ms = 0.2 tiles.
    // It should move towards the door.

    // Step 1: Move closer
    // In current grid implementation, if the target is in the next cell and the boundary is blocked,
    // the unit waits immediately even if physically in the center of the current tile.
    engine.update(100);
    let unit = engine.getState().units[0];

    // It should be waiting immediately because the path to the next cell is blocked
    expect(unit.state).toBe(UnitState.WaitingForDoor);

    // Position should NOT have changed (blocked)
    expect(unit.pos.x).toBe(0.5);

    // Step 2: Open Door Logic Simulation
    // ...

    // Check state is maintained
    expect(unit.state).toBe(UnitState.WaitingForDoor);
  });
});
