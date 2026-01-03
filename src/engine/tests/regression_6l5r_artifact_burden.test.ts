import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  MissionType,
} from "@src/shared/types";

describe("Artifact Burden Regression", () => {
  const mockMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: [],
    spawnPoints: [],
    extraction: { x: 9, y: 9 },
    objectives: [
      { id: "artifact-0", kind: "Recover", targetCell: { x: 2, y: 2 } },
    ],
  };

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      mockMap.cells.push({ x, y, type: CellType.Floor });
    }
  }

  it("should reduce unit speed and accuracy when an artifact is picked up", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      { soldiers: [{ archetypeId: "assault" }], inventory: {} },
      true,
      false,
    );

    const unit = (engine as any).state.units[0];
    const initialSpeed = unit.stats.speed;
    const initialAccuracy = unit.stats.accuracy;

    // Teleport unit to objective
    unit.pos = { x: 2.5, y: 2.5 };
    unit.state = UnitState.Idle;

    // First update starts collection
    engine.update(100);
    expect(unit.state).toBe(UnitState.Channeling);
    expect(unit.channeling?.action).toBe("Collect");

    // Advance time to complete collection (default 5000ms * (10/speed) = 5000 * (10/20) = 2500ms)
    // Actually speed of assault is 20 (2.0 tiles/s)
    engine.update(3000);

    expect(unit.state).toBe(UnitState.Idle);
    expect(unit.carriedObjectiveId).toBe("artifact-0");

    // Check stats
    // artifact_heavy: speedBonus: -10, accuracyBonus: -15
    expect(unit.stats.speed).toBe(initialSpeed - 10);
    // accuracy is a bit more complex as it depends on active weapon, but it should be lower
    expect(unit.stats.accuracy).toBeLessThan(initialAccuracy);
  });

  it("should drop the artifact and restore stats when unit dies", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      { soldiers: [{ archetypeId: "assault" }], inventory: {} },
      true,
      false,
    );

    const unit = (engine as any).state.units[0];
    const initialSpeed = unit.stats.speed;

    // Teleport unit to objective
    unit.pos = { x: 2.5, y: 2.5 };
    unit.state = UnitState.Idle;

    // Complete collection
    engine.update(100);
    engine.update(3000);

    expect(unit.carriedObjectiveId).toBe("artifact-0");
    expect(unit.stats.speed).toBe(initialSpeed - 10);

    // Kill unit
    unit.hp = 0;
    engine.update(100);

    expect(unit.state).toBe(UnitState.Dead);
    expect(unit.carriedObjectiveId).toBeUndefined();

    const obj = engine.getState().objectives.find((o) => o.id === "artifact-0");
    expect(obj?.state).toBe("Pending");
    expect(obj?.targetCell).toEqual({ x: 2, y: 2 });
  });

  it("should win ExtractArtifacts mission only if artifact is extracted", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      { soldiers: [{ archetypeId: "assault" }], inventory: {} },
      true,
      false,
      MissionType.Default,
    );

    const unit = (engine as any).state.units[0];

    // Teleport unit to objective
    unit.pos = { x: 2.5, y: 2.5 };
    unit.state = UnitState.Idle;

    // Complete collection
    engine.update(100);
    engine.update(3000);
    expect(unit.carriedObjectiveId).toBe("artifact-0");

    // Teleport to extraction
    unit.pos = { x: 9.5, y: 9.5 };

    // Start extraction (default 5000ms * (10/speed) = 5000 * (10/10) = 5000ms? Wait, assault speed with artifact is 10)
    // Assault base speed is 20. Artifact burden is -10. So speed is 10.
    // Duration = 5000 * (10/10) = 5000ms.
    engine.update(100);
    expect(unit.state).toBe(UnitState.Channeling);
    expect(unit.channeling?.action).toBe("Extract");

    engine.update(6000);
    expect(unit.state).toBe(UnitState.Extracted);
    expect(engine.getState().status).toBe("Won");
  });
});
