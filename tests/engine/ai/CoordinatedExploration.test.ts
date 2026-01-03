import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  SquadConfig,
  CommandType,
  AIProfile,
} from "@src/shared/types";

describe("Coordinated Exploration", () => {
  let engine: CoreEngine;
  let map: MapDefinition;

  beforeEach(() => {
    // 5x1 Map: Unknown | Floor | Floor | Floor | Unknown
    // Indices: 0,0 (Floor) | 1,0 (Floor) | 2,0 (Floor) | 3,0 (Floor) | 4,0 (Floor)
    // We will manually manipulate discovery.

    map = {
      width: 5,
      height: 1,
      cells: [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 1, y: 0, type: CellType.Floor },
        { x: 2, y: 0, type: CellType.Floor },
        { x: 3, y: 0, type: CellType.Floor },
        { x: 4, y: 0, type: CellType.Floor },
      ],
      spawnPoints: [],
      extraction: undefined,
      objectives: [
        {
          id: "obj_explore",
          kind: "Recover",
          targetCell: { x: 99, y: 0 },
        },
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
        {
          id: "d2",
          segment: [
            { x: 3, y: 0 },
            { x: 4, y: 0 },
          ],
          orientation: "Vertical",
          state: "Closed",
          hp: 100,
          maxHp: 100,
          openDuration: 1,
        },
      ],
    };

    const squad: SquadConfig = { soldiers: [], inventory: {} };
    engine = new CoreEngine(map, 123, squad, true, false); // agentControl = true
    engine.clearUnits();
  });

  it("should assign different exploration targets to units", () => {
    // Add 2 units at center (2,0)
    engine.addUnit({
      id: "u1",
      pos: { x: 2.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 10,
        fireRate: 500,
        accuracy: 1000,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 5,
        speed: 20,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      archetypeId: "assault",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
    });
    engine.addUnit({
      id: "u2",
      pos: { x: 2.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 10,
        fireRate: 500,
        accuracy: 1000,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 5,
        speed: 20,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      archetypeId: "assault",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
    });

    // Manually set discovered cells to include only center and adjacent
    // Undiscovered: (0,0) and (4,0)
    // Both are at distance 2 from center.
    (engine as any).state.discoveredCells = ["1,0", "2,0", "3,0"];

    // Run update.
    engine.update(100);

    const u1 = engine.getState().units[0];
    const u2 = engine.getState().units[1];

    expect(u1.state).toBe(UnitState.Moving);
    expect(u2.state).toBe(UnitState.Moving);
    expect(u1.explorationTarget).toBeDefined();
    expect(u2.explorationTarget).toBeDefined();

    // With coordinated exploration, they should target different cells if available.
    // One should target 0,0, other 4,0.

    const t1 = u1.explorationTarget!;
    const t2 = u2.explorationTarget!;

    // Check they are different
    expect(t1.x === t2.x && t1.y === t2.y).toBe(false);

    // Check they are valid targets (0,0 or 4,0)
    const validX = [0, 4];
    expect(validX).toContain(Math.floor(t1.x));
    expect(validX).toContain(Math.floor(t2.x));
  });
});
