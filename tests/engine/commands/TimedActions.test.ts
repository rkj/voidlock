import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  CommandType,
} from "@src/shared/types";

describe("Timed Actions (Extraction/Collection)", () => {
  const mockMap: MapDefinition = {
    width: 5,
    height: 5,
    cells: [],
    spawnPoints: [],
    extraction: { x: 4, y: 4 },
  };

  // Fill cells
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      mockMap.cells.push({ x, y, type: CellType.Floor });
    }
  }

  it("should delay extraction by 5 seconds", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      { soldiers: [{ archetypeId: "scout" }], inventory: {} },
      false, // Manual control
      false,
    );

    const realUnit = (engine as any).state.units[0];
    // Teleport unit near extraction
    realUnit.pos = { x: 3.5, y: 4.5 };

    // Command to move to extraction
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: [realUnit.id],
      target: { x: 4, y: 4 },
    });

    // Move to extraction
    // Distance 0.5 tiles. Speed 2 tiles/s. Should take 0.25s.
    engine.update(1100); // Wait longer to be safe // Wait longer to be safe

    // Unit should be at extraction
    const unitAfterMove = engine.getState().units[0];
    expect(Math.floor(unitAfterMove.pos.x)).toBe(4);
    expect(Math.floor(unitAfterMove.pos.y)).toBe(4);

    // Should be Channeling now
    engine.update(100);

    const unitChanneling = engine.getState().units[0];
    expect(unitChanneling.state).toBe(UnitState.Channeling);
    expect(unitChanneling.channeling).toBeDefined();
    expect(unitChanneling.channeling?.action).toBe("Extract");
    // Speed is 30, base is 5000. 5000 * (30/30) = 5000
    expect(unitChanneling.channeling?.totalDuration).toBe(5000);
    expect(unitChanneling.channeling?.remaining).toBeLessThanOrEqual(5000);

    // Advance 4 seconds
    engine.update(4000);
    const unitStillChanneling = engine.getState().units[0];
    expect(unitStillChanneling.state).toBe(UnitState.Channeling);
    expect(unitStillChanneling.state).not.toBe(UnitState.Extracted);

    // Advance 1.1 seconds (Total > 5s)
    engine.update(1100);
    const unitExtracted = engine.getState().units[0];
    expect(unitExtracted.state).toBe(UnitState.Extracted);
  });

  it("should delay collection by 3 seconds", () => {
    const objMap: MapDefinition = {
      ...mockMap,
      objectives: [{ id: "obj1", kind: "Recover", targetCell: { x: 2, y: 2 } }],
    };

    const engine = new CoreEngine(
      objMap,
      123,
      { soldiers: [{ archetypeId: "scout" }], inventory: {} },
      false,
      false,
    );

    const realUnit = (engine as any).state.units[0];
    realUnit.pos = { x: 1.5, y: 2.5 };

    // Move to objective
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: [realUnit.id],
      target: { x: 2, y: 2 },
    });

    // Arrive
    engine.update(1100); // Wait longer to be safe // 0.5 dist / 2 speed = 0.25s
    engine.update(100); // Trigger check

    const unitChanneling = engine.getState().units[0];
    expect(Math.floor(unitChanneling.pos.x)).toBe(2);
    expect(Math.floor(unitChanneling.pos.y)).toBe(2);
    expect(unitChanneling.state).toBe(UnitState.Channeling);
    expect(unitChanneling.channeling?.action).toBe("Collect");
    // Speed is 30, base is 3000. 3000 * (30/30) = 3000
    expect(unitChanneling.channeling?.totalDuration).toBe(3000);

    // Advance
    engine.update(2500);
    expect(engine.getState().units[0].state).toBe(UnitState.Channeling);
    const objBefore = engine.getState().objectives[0];
    expect(objBefore.state).toBe("Pending");

    // Finish
    engine.update(600);
    const unitIdle = engine.getState().units[0];
    expect(unitIdle.state).toBe(UnitState.Idle); // Should be Idle after collection
    const objAfter = engine.getState().objectives[0];
    expect(objAfter.state).toBe("Completed");
  });

  it("should interrupt channeling on STOP command", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      { soldiers: [{ archetypeId: "scout" }], inventory: {} },
      false,
      false,
    );

    const realUnit = (engine as any).state.units[0];
    realUnit.pos = { x: 4.5, y: 4.5 }; // Already at extraction

    // Trigger check
    engine.update(100);
    const unitChanneling = engine.getState().units[0];
    expect(unitChanneling.state).toBe(UnitState.Channeling);

    // Interrupt
    engine.applyCommand({
      type: CommandType.STOP,
      unitIds: [realUnit.id],
    });

    // Check immediate effect (STOP clears it)
    // Need to get state AFTER applyCommand (which runs synchronously but doesn't return state)
    // Actually applyCommand modifies real state.
    const unitStopped = engine.getState().units[0];
    expect(unitStopped.state).toBe(UnitState.Idle);
    expect(unitStopped.channeling).toBeUndefined();

    // Verify extraction did NOT happen
    engine.update(6000);
    const unitAfter = engine.getState().units[0];
    expect(unitAfter.state).not.toBe(UnitState.Extracted);

    // As noted before, it will restart channeling because it is still at the point.
    expect(unitAfter.state).toBe(UnitState.Channeling);
  });

  it("should interrupt channeling on MOVE command", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      { soldiers: [{ archetypeId: "scout" }], inventory: {} },
      false,
      false,
    );

    const realUnit = (engine as any).state.units[0];
    realUnit.pos = { x: 4.5, y: 4.5 };
    engine.update(100);
    expect(engine.getState().units[0].state).toBe(UnitState.Channeling);

    // Move away
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: [realUnit.id],
      target: { x: 0, y: 0 },
    });

    const unitMoved = engine.getState().units[0];
    // executeCommand sets Idle (if instant) or Moving.
    // Since target is far, it should be Moving?
    // Wait, executeCommand sets Moving if path found.
    // But update() hasn't run yet.
    // executeCommand logic:
    // ... finds path ... unit.state = UnitState.Moving
    expect(unitMoved.state).toBe(UnitState.Moving);
    expect(unitMoved.channeling).toBeUndefined();

    engine.update(100);
    // Should be Moving now
    expect(engine.getState().units[0].state).toBe(UnitState.Moving);
  });

  it("should couple extraction to game time (scaledDt)", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      { soldiers: [{ archetypeId: "scout" }], inventory: {} },
      false,
      false,
    );

    const realUnit = (engine as any).state.units[0];
    realUnit.pos = { x: 4.5, y: 4.5 }; // Already at extraction

    // Trigger check (both scaled and real are 100)
    engine.update(100);
    const unitChanneling = engine.getState().units[0];
    expect(unitChanneling.state).toBe(UnitState.Channeling);
    const initialRemaining = unitChanneling.channeling?.remaining || 5000;

    // Advance with high game speed (scaledDt = 1000, realDt = 100)
    engine.update(1000);

    const unitAfterHighSpeed = engine.getState().units[0];
    // Remaining should have decreased by scaledDt (1000), not realDt (100)
    expect(unitAfterHighSpeed.channeling?.remaining).toBe(
      initialRemaining - 1000,
    );

    // state.t should have increased by scaledDt (1000)
    // initial state.t was 100 (from first update)
    // now it should be 1100.
    expect(engine.getState().t).toBe(1100);
  });
});
