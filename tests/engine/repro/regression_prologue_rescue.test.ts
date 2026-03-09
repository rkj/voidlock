import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import { MissionType, UnitState, EnemyType } from "@src/shared/types";

describe("Prologue Honest Difficulty & Scripted Rescue", () => {
  const mockMap = {
    width: 6,
    height: 6,
    cells: [{ x: 1, y: 1, type: "Floor" as const }],
    spawnPoints: [{ id: "enemy-1", pos: { x: 2, y: 2 }, radius: 0 }],
    squadSpawn: { x: 1, y: 1 },
    squadSpawns: [{ x: 1, y: 1 }],
    extraction: { x: 5, y: 5 },
    objectives: [],
  };

  const squadConfig = {
    soldiers: [{ archetypeId: "assault" }],
    inventory: {},
  };

  it("should remove HP clamp and implement scripted rescue in prologue", () => {
    const engine = new CoreEngine(
      mockMap,
      12345,
      squadConfig,
      false, // agentControlEnabled
      false, // debugOverlayEnabled
      MissionType.Prologue
    );

    const state = engine.getState();
    const unit = state.units[0];
    expect(unit.hp).toBe(100);

    // Manually drop unit HP to 0
    unit.hp = 0;

    // Run simulation step
    // @ts-ignore - access private for test
    engine.simulationStep(16);

    const updatedState = engine.getState();
    const updatedUnit = updatedState.units[0];

    // Should be rescued: healed to 50% HP (50) and state set to Idle
    expect(updatedUnit.hp).toBe(50);
    expect(updatedUnit.state).toBe(UnitState.Idle);
    expect(updatedState.stats.prologueRescues).toBe(1);
  });

  it("should spawn the tutorial enemy with correct stats in prologue", () => {
    const engine = new CoreEngine(
      mockMap,
      12345,
      squadConfig,
      false,
      false,
      MissionType.Prologue
    );

    const state = engine.getState();
    const tutorialEnemy = state.enemies.find(e => e.type === EnemyType.Tutorial);
    
    expect(tutorialEnemy).toBeDefined();
    expect(tutorialEnemy?.maxHp).toBe(20);
    expect(tutorialEnemy?.damage).toBe(5);
    expect(tutorialEnemy?.accuracy).toBe(30);
  });
});
