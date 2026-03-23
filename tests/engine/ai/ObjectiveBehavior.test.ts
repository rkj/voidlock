import { describe, it, expect } from "vitest";
import { ObjectiveBehavior } from "@src/engine/ai/behaviors/ObjectiveBehavior";
import { PRNG } from "@src/shared/PRNG";
import { Unit, GameState, UnitState, CommandType } from "@src/shared/types";

describe("ObjectiveBehavior", () => {
  it("should prioritize extraction when in extraction cell and objectives are complete", () => {
    const behavior = new ObjectiveBehavior();
    const prng = new PRNG(123);

    const unit: Unit = {
      id: "u1",
      pos: { x: 0.5, y: 0.5 }, // In extraction cell (0,0)
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
      aiProfile: "RUSH" as any,
      commandQueue: [],
      engagementPolicy: "ENGAGE" as any,
      archetypeId: "assault",
      kills: 0,
      damageDealt: 0, 
      objectivesCompleted: 0, 
      positionHistory: [],
      aiEnabled: true,
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
    } as any;

    const context: any = {
      agentControlEnabled: true,
      claimedObjectives: new Map(),
      itemAssignments: new Map(),
      executeCommand: (params: any) => ({ ...params.unit, activeCommand: params.cmd }),
    };

    const result = behavior.evaluate({ unit, state, context, director: {} as any });

    expect(result.handled).toBe(true);
    expect(result.unit.activeCommand?.label).toBe("Extracting");
    expect(result.unit.activeCommand?.type).toBe(CommandType.EXTRACT);
  });
});
