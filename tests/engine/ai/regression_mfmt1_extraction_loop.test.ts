import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  CommandType,
  MissionType,
} from "@src/shared/types";

describe("Regression MFMT1 - Extraction Loop", () => {
  const map: MapDefinition = {
    width: 6,
    height: 1,
    cells: [
      { x: 0, y: 0, type: CellType.Floor },
      { x: 1, y: 0, type: CellType.Floor },
      { x: 2, y: 0, type: CellType.Floor },
      { x: 3, y: 0, type: CellType.Floor },
      { x: 4, y: 0, type: CellType.Floor },
      { x: 5, y: 0, type: CellType.Floor },
    ],
    spawnPoints: [],
    extraction: { x: 0, y: 0 },
    objectives: [
      {
        id: "obj-0",
        kind: "Recover",
        targetCell: { x: 5, y: 0 },
        state: "Pending",
        visible: true,
      },
    ],
  };

  let engine: CoreEngine;

  beforeEach(() => {
    engine = new CoreEngine(
      map,
      123,
      { soldiers: [], inventory: {} },
      true,
      false,
      MissionType.Default,
    );
    engine.clearUnits();
  });

  it("should prioritize extraction when in extraction cell even if moving to exploration target", () => {
    // 1. Add unit near objective
    engine.addUnit({
      id: "u1",
      pos: { x: 5.0, y: 0.0 }, // AT objective
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 10,
        fireRate: 100,
        accuracy: 100,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 10,
        speed: 100.0,
      },
      aiProfile: "RUSH",
      commandQueue: [],
      engagementPolicy: "ENGAGE",
      archetypeId: "assault",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
      aiEnabled: true,
    });

    // Ensure objective and extraction discovered
    // We can't modify discoveredCells directly in engine, but we can update engine
    // until it's discovered. Or just use a map where everything is visible.
    
    // Actually, I can use engine.applyCommand to set a unit to EXPLORE and it will discover cells.
    
    // 2. Update until objective is completed (Channeling: Collect)
    // Speed 100 might be overwritten by StatsManager, so we wait longer.
    for(let i=0; i<100; i++) engine.update(100);
    
    let state = engine.getState();
    console.log(`Objective state: ${state.objectives[0].state}, Unit state: ${state.units[0].state}`);
    
    // Ensure all cells are discovered for auto-extraction to trigger
    (engine as any).state.discoveredCells = ["0,0", "1,0", "2,0", "3,0", "4,0", "5,0"];
    for (let i = 0; i < 6; i++) (engine as any).state.gridState[i] |= 2;

    // 3. Manually move unit to extraction cell (0.1, 0.1) in the engine's state copy
    // and hope it persists? No, it won't.
    
    // I'll use a unit at (0.1, 0.1) from the start, but then it won't be at objective.
    // I'll add TWO units. One to complete objective, one at extraction.
    
    engine.addUnit({
      id: "u2",
      pos: { x: 0.1, y: 0.1 }, // AT extraction
      hp: 100,
      maxHp: 100,
      state: UnitState.Moving,
      stats: {
        damage: 10,
        fireRate: 100,
        accuracy: 100,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 10,
        speed: 1.0,
      },
      aiProfile: "RUSH",
      commandQueue: [],
      engagementPolicy: "ENGAGE",
      archetypeId: "assault",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
      aiEnabled: true,
      explorationTarget: { x: 5, y: 0 },
      activeCommand: {
        type: CommandType.MOVE_TO,
        unitIds: ["u2"],
        target: { x: 5, y: 0 },
        label: "Exploring",
      },
      targetPos: { x: 1.5, y: 0.5 },
    });

    // Update again to let AI process
    engine.update(16);
    
    state = engine.getState();
    const u2 = state.units.find(u => u.id === "u2")!;
    
    console.log(`Unit u2 Pos: ${u2.pos.x.toFixed(2)},${u2.pos.y.toFixed(2)}, Command: ${u2.activeCommand?.label}, State: ${u2.state}`);
    
    // EXPECTATION: u2 should have triggered extraction because u1 completed the objective
    expect(u2.activeCommand?.label === "Extracting" || u2.state === UnitState.Channeling).toBe(true);
  });
});
