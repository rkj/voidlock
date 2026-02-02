import { describe, it, expect, vi } from "vitest";
import { MissionManager } from "@src/engine/managers/MissionManager";
import { GameState, MissionType, UnitState, EnemyType } from "@src/shared/types";
import { PRNG } from "@src/shared/PRNG";

describe("MissionManager Expendable Win Logic", () => {
  const prng = new PRNG(123);

  const createBaseState = (missionType: MissionType): GameState => ({
    t: 0,
    seed: 123,
    missionType,
    map: { width: 10, height: 10, cells: [], walls: [], boundaries: [], spawnPoints: [], objectives: [], extraction: { x: 0, y: 0 } },
    units: [],
    enemies: [],
    visibleCells: [],
    discoveredCells: [],
    objectives: [],
    stats: { threatLevel: 0, aliensKilled: 0, elitesKilled: 0, scrapGained: 0, casualties: 0 },
    status: "Playing",
    settings: { mode: "Simulation" as any, debugOverlayEnabled: false, losOverlayEnabled: false, timeScale: 1, isPaused: false, isSlowMotion: false, allowTacticalPause: true },
    squadInventory: {},
    loot: [],
    mines: [],
    turrets: []
  });

  it("should win DestroyHive mission immediately when hive is destroyed, even if squad wipes later", () => {
    const manager = new MissionManager(MissionType.DestroyHive, prng);
    const state = createBaseState(MissionType.DestroyHive);
    
    state.units = [
      { id: "u1", pos: { x: 1, y: 1 }, hp: 100, maxHp: 100, state: UnitState.Idle, archetypeId: "assault", stats: {} as any, kills: 0, damageDealt: 0, objectivesCompleted: 0, commandQueue: [], aiProfile: "RUSH" as any }
    ];
    state.objectives = [{ id: "obj-hive", kind: "Kill", state: "Pending", targetEnemyId: "hive1" }];
    
    // 1. Objective complete
    state.objectives[0].state = "Completed";
    manager.checkWinLoss(state);
    expect(state.status).toBe("Won");
    
    // 2. Squad wipes
    state.units[0].state = UnitState.Dead;
    state.units[0].hp = 0;
    manager.checkWinLoss(state);
    expect(state.status).toBe("Won"); // Should remain Won
  });

  it("should lose DestroyHive mission if squad wipes before hive is destroyed", () => {
    const manager = new MissionManager(MissionType.DestroyHive, prng);
    const state = createBaseState(MissionType.DestroyHive);
    
    state.units = [
      { id: "u1", pos: { x: 1, y: 1 }, hp: 0, maxHp: 100, state: UnitState.Dead, archetypeId: "assault", stats: {} as any, kills: 0, damageDealt: 0, objectivesCompleted: 0, commandQueue: [], aiProfile: "RUSH" as any }
    ];
    state.objectives = [{ id: "obj-hive", kind: "Kill", state: "Pending", targetEnemyId: "hive1" }];
    
    manager.checkWinLoss(state);
    expect(state.status).toBe("Lost");
  });

  it("should win EscortVIP if VIP extracts, regardless of squad casualties", () => {
    const manager = new MissionManager(MissionType.EscortVIP, prng);
    const state = createBaseState(MissionType.EscortVIP);
    
    state.units = [
      { id: "s1", pos: { x: 1, y: 1 }, hp: 0, maxHp: 100, state: UnitState.Dead, archetypeId: "assault", stats: {} as any, kills: 0, damageDealt: 0, objectivesCompleted: 0, commandQueue: [], aiProfile: "RUSH" as any },
      { id: "v1", pos: { x: 0, y: 0 }, hp: 100, maxHp: 100, state: UnitState.Extracted, archetypeId: "vip", stats: {} as any, kills: 0, damageDealt: 0, objectivesCompleted: 0, commandQueue: [], aiProfile: "RETREAT" as any }
    ];
    state.objectives = [{ id: "obj-escort", kind: "Escort", state: "Completed" }];
    
    manager.checkWinLoss(state);
    expect(state.status).toBe("Won");
  });

  it("should lose EscortVIP if VIP dies", () => {
    const manager = new MissionManager(MissionType.EscortVIP, prng);
    const state = createBaseState(MissionType.EscortVIP);
    
    state.units = [
      { id: "s1", pos: { x: 1, y: 1 }, hp: 100, maxHp: 100, state: UnitState.Idle, archetypeId: "assault", stats: {} as any, kills: 0, damageDealt: 0, objectivesCompleted: 0, commandQueue: [], aiProfile: "RUSH" as any },
      { id: "v1", pos: { x: 5, y: 5 }, hp: 0, maxHp: 100, state: UnitState.Dead, archetypeId: "vip", stats: {} as any, kills: 0, damageDealt: 0, objectivesCompleted: 0, commandQueue: [], aiProfile: "RETREAT" as any }
    ];
    
    manager.checkWinLoss(state);
    expect(state.status).toBe("Lost");
  });

  it("should win ExtractArtifacts if artifacts are extracted and then squad wipes", () => {
    const manager = new MissionManager(MissionType.ExtractArtifacts, prng);
    const state = createBaseState(MissionType.ExtractArtifacts);
    
    state.units = [
      { id: "s1", pos: { x: 0, y: 0 }, hp: 100, maxHp: 100, state: UnitState.Extracted, archetypeId: "assault", stats: {} as any, kills: 0, damageDealt: 0, objectivesCompleted: 0, commandQueue: [], aiProfile: "RUSH" as any, carriedObjectiveId: "artifact-1" },
      { id: "s2", pos: { x: 5, y: 5 }, hp: 0, maxHp: 100, state: UnitState.Dead, archetypeId: "assault", stats: {} as any, kills: 0, damageDealt: 0, objectivesCompleted: 0, commandQueue: [], aiProfile: "RUSH" as any }
    ];
    state.objectives = [{ id: "artifact-1", kind: "Recover", state: "Completed" }];
    
    manager.checkWinLoss(state);
    expect(state.status).toBe("Won");
  });
});
