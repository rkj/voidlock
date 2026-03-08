import { describe, it, expect } from "vitest";
import { ObjectiveBehavior } from "@src/engine/ai/behaviors/ObjectiveBehavior";
import {
  GameState,
  Unit,
  UnitState,
  CommandType,
  CellType,
} from "@src/shared/types";
import { PRNG } from "@src/shared/PRNG";

describe("ObjectiveBehavior", () => {
  const behavior = new ObjectiveBehavior();
  const prng = new PRNG(123);

  it("should prioritize extraction when in extraction cell and objectives are complete", () => {
    const unit: Unit = {
      id: "u1",
      pos: { x: 0.1, y: 0.1 },
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
      damageDealt: 0, objectivesCompleted: 0, positionHistory: [],
      aiEnabled: true,
      activeCommand: {
        type: CommandType.MOVE_TO,
        unitIds: ["u1"],
        target: { x: 5, y: 0 },
        label: "Exploring",
      },
      explorationTarget: { x: 5, y: 0 },
    };

    const state: GameState = {
      t: 0,
      seed: 123,
      missionType: "Default" as any,
      nodeType: "Combat",
      map: {
        width: 6,
        height: 1,
        cells: [],
        spawnPoints: [],
        extraction: { x: 0, y: 0 },
      },
      units: [unit],
      enemies: [],
      loot: [],
      mines: [],
      turrets: [],
      visibleCells: ["0,0"],
      discoveredCells: ["0,0"],
      gridState: new Uint8Array(6),
      objectives: [
        {
          id: "obj-0",
          kind: "Recover",
          targetCell: { x: 5, y: 0 },
          state: "Completed",
          visible: true,
        },
      ],
      stats: {
        threatLevel: 0,
        aliensKilled: 0,
        elitesKilled: 0,
        scrapGained: 0,
        casualties: 0,
      },
      status: "Playing",
      settings: {
        mode: "Simulation" as any,
        debugOverlayEnabled: false,
        debugSnapshots: false,
        debugSnapshotInterval: 0,
        losOverlayEnabled: false,
        timeScale: 1,
        isPaused: false,
        isSlowMotion: false,
        allowTacticalPause: true,
      },
      squadInventory: {},
    };

    const context: any = {
      agentControlEnabled: true,
      claimedObjectives: new Map(),
      itemAssignments: new Map(),
      executeCommand: (u: Unit, cmd: any) => ({ ...u, activeCommand: cmd }),
    };

    const result = behavior.evaluate(unit, state, 16, new Map(), prng, context);

    expect(result.handled).toBe(true);
    expect(result.unit.activeCommand?.label).toBe("Extracting");
    expect(result.unit.activeCommand?.type).toBe(CommandType.EXTRACT);
    expect((result.unit.activeCommand as any).target).toBeUndefined();
  });

  it("should skip objectives with missing enemy targets instead of pathing to {0.5, 0.5} (Regression voidlock-5ubdf.2)", () => {
    const unit: Unit = {
      id: "u1",
      pos: { x: 2.5, y: 2.5 },
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
        speed: 1.0,
      },
      aiProfile: "RUSH",
      commandQueue: [],
      engagementPolicy: "ENGAGE",
      archetypeId: "assault",
      kills: 0,
      damageDealt: 0, objectivesCompleted: 0, positionHistory: [],
      aiEnabled: true,
      activeCommand: undefined,
    };

    const state: GameState = {
      t: 0,
      seed: 123,
      missionType: "Default" as any,
      nodeType: "Combat",
      map: {
        width: 10,
        height: 10,
        cells: [],
        spawnPoints: [],
      },
      units: [unit],
      enemies: [], // No enemies
      loot: [],
      mines: [],
      turrets: [],
      visibleCells: ["2,2"],
      discoveredCells: ["2,2"],
      gridState: new Uint8Array(100),
      objectives: [
        {
          id: "obj-missing-enemy",
          kind: "Kill",
          targetEnemyId: "non-existent-enemy",
          state: "Pending",
          visible: true,
        },
      ],
      stats: {
        threatLevel: 0,
        aliensKilled: 0,
        elitesKilled: 0,
        scrapGained: 0,
        casualties: 0,
      },
      status: "Playing",
      settings: {
        mode: "Simulation" as any,
        debugOverlayEnabled: false,
        debugSnapshots: false,
        debugSnapshotInterval: 0,
        losOverlayEnabled: false,
        timeScale: 1,
        isPaused: false,
        isSlowMotion: false,
        allowTacticalPause: true,
      },
      squadInventory: {},
    };

    const context: any = {
      agentControlEnabled: true,
      claimedObjectives: new Map(),
      itemAssignments: new Map(),
      executeCommand: (u: Unit, cmd: any) => ({ ...u, activeCommand: cmd, state: UnitState.Moving }),
      totalFloorCells: 100,
    };

    const result = behavior.evaluate(unit, state, 16, new Map(), prng, context);

    // Should NOT be handled (skipped the objective because it has no valid position)
    expect(result.handled).toBe(false);
    expect(result.unit.activeCommand).toBeUndefined();
  });
});
