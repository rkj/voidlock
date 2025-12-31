import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  SquadConfig,
  MissionType,
} from "../../shared/types";

describe("Regression MPLV: Escort Objective Ignored", () => {
  let engine: CoreEngine;
  let mockMap: MapDefinition;
  const squadWithVip: SquadConfig = [
    { archetypeId: "assault", count: 1 },
    { archetypeId: "vip", count: 1 },
  ];

  beforeEach(() => {
    mockMap = {
      width: 10,
      height: 10,
      cells: [],
      spawnPoints: [{ id: "s1", pos: { x: 0, y: 0 }, radius: 1 }],
      extraction: { x: 9, y: 9 },
      objectives: [],
    };

    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        mockMap.cells.push({ x, y, type: CellType.Floor });
      }
    }

    engine = new CoreEngine(
      mockMap,
      123,
      squadWithVip,
      true,
      false,
      MissionType.EscortVIP,
    );
  });

  it("should prioritize escort objective (extraction) when visible", () => {
    engine.clearUnits();
    // Soldier at (0,0)
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 500,
      accuracy: 100,
      soldierAim: 90,
      attackRange: 10,
      sightRange: 20, // Can see everything
      speed: 10,
      commandQueue: [],
      archetypeId: "assault",
      aiEnabled: true,
    } as any);
    // VIP at (1,1)
    engine.addUnit({
      id: "vip-1",
      pos: { x: 1.5, y: 1.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 0,
      fireRate: 0,
      accuracy: 50,
      soldierAim: 50,
      attackRange: 0,
      sightRange: 10,
      speed: 10,
      commandQueue: [],
      archetypeId: "vip",
      aiEnabled: true,
    } as any);

    // Initial update to process mission setup and visibility
    engine.update(100);

    const state1 = engine.getState();
    const escortObj = state1.objectives.find((o) => o.kind === "Escort");
    expect(escortObj).toBeDefined();
    expect(escortObj?.state).toBe("Pending");
    expect(escortObj?.visible).toBe(true);

    const unit1 = state1.units.find((u) => u.id === "u1")!;
    // If it's ignoring the Escort objective, it will be "Exploring"
    // instead of "Recovering" (or similar for Escort)
    console.log("Unit 1 Label:", unit1.activeCommand?.label);

    // Actually, Escort objective doesn't have a specific label in the code yet,
    // it's just NOT handled in the prioritization loop.
    // So it will likely be "Exploring".
    expect(unit1.activeCommand?.label).not.toBe("Exploring");
  });
});
