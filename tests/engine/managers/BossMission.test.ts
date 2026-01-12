import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MissionType,
  CellType,
  MapDefinition,
  SquadConfig,
  UnitState,
} from "@src/shared/types";

describe("Boss Mission Objectives and Rewards", () => {
  const mockMap: MapDefinition = {
    width: 20,
    height: 20,
    cells: [],
    spawnPoints: [{ id: "spawn-1", pos: { x: 1, y: 1 }, radius: 1 }],
    squadSpawn: { x: 1, y: 1 },
    extraction: { x: 19, y: 19 },
    objectives: [],
  };

  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      // Create some rooms for Hive placement
      const roomId = (x > 15 && y > 15) ? "room-target" : (x < 5 && y < 5) ? "room-start" : undefined;
      mockMap.cells.push({ x, y, type: CellType.Floor, roomId });
    }
  }

  const squadConfig: SquadConfig = {
    soldiers: [{ id: "s1", archetypeId: "assault" }],
    inventory: {},
  };

  it("should generate 3 objectives for a Boss mission (2x Recover, 1x Hive)", () => {
    const engine = new CoreEngine(
      mockMap,
      1,
      squadConfig,
      true,
      false,
      MissionType.Default,
      false,
      0,
      1.0,
      false,
      undefined,
      [],
      true,
      0,
      3,
      1,
      0,
      "Boss"
    );

    const state = engine.getState();
    expect(state.objectives.length).toBe(3);
    
    const recoverObjectives = state.objectives.filter(o => o.kind === "Recover");
    const killObjectives = state.objectives.filter(o => o.kind === "Kill");
    
    expect(recoverObjectives.length).toBe(2);
    expect(killObjectives.length).toBe(1);
    expect(killObjectives[0].targetEnemyId).toBe("boss-hive");
    
    const bossHive = state.enemies.find(e => e.id === "boss-hive");
    expect(bossHive).toBeDefined();
    expect(bossHive?.hp).toBe(1000);
  });

  it("should reward 3x scrap for Boss objectives and mission completion", () => {
    const engine = new CoreEngine(
      mockMap,
      1,
      squadConfig,
      true,
      false,
      MissionType.Default,
      false,
      0,
      1.0,
      false,
      undefined,
      [],
      true,
      0,
      3,
      1,
      0,
      "Boss"
    );

    let state = engine.getState();
    const initialScrap = state.stats.scrapGained;

    // 1. Complete a Recover objective
    const recoverObj = state.objectives.find(o => o.kind === "Recover")!;
    // In engine, we need to bypass internal state for testing easily or trigger completion
    // MissionManager.updateObjectives rewards scrap.
    
    // We can simulate completion by setting state and calling update
    (engine as any).state.objectives.find((o: any) => o.id === recoverObj.id).state = "Completed";
    engine.update(16);
    
    state = engine.getState();
    // Standard Recover is 25. Boss is 75.
    expect(state.stats.scrapGained).toBe(initialScrap + 75);

    // 2. Complete Boss Hive objective
    const hiveObj = state.objectives.find(o => o.kind === "Kill")!;
    (engine as any).state.objectives.find((o: any) => o.id === hiveObj.id).state = "Completed";
    engine.update(16);
    
    state = engine.getState();
    // Standard Hive is 75. Boss is 225.
    // Total should be 75 + 225 = 300.
    expect(state.stats.scrapGained).toBe(initialScrap + 300);

    // 3. Complete last Recover objective
    const lastRecoverObj = state.objectives.filter(o => o.kind === "Recover")[1];
    (engine as any).state.objectives.find((o: any) => o.id === lastRecoverObj.id).state = "Completed";
    engine.update(16);
    
    state = engine.getState();
    // Total: 300 + 75 = 375. 
    // PLUS mission win reward (100 * 3 = 300) since all objectives are now complete.
    // Total: 675
    expect(state.status).toBe("Won");
    expect(state.stats.scrapGained).toBe(initialScrap + 675);
  });

  it("should generate 2 objectives for an Elite mission (1x Recover, 1x Hive)", () => {
    const engine = new CoreEngine(
      mockMap,
      1,
      squadConfig,
      true,
      false,
      MissionType.Default,
      false,
      0,
      1.0,
      false,
      undefined,
      [],
      true,
      0,
      3,
      1,
      0,
      "Elite"
    );

    const state = engine.getState();
    expect(state.objectives.length).toBe(2);
    
    const recoverObjectives = state.objectives.filter(o => o.kind === "Recover");
    const killObjectives = state.objectives.filter(o => o.kind === "Kill");
    
    expect(recoverObjectives.length).toBe(1);
    expect(killObjectives.length).toBe(1);
    expect(killObjectives[0].targetEnemyId).toBe("elite-hive");
    
    const eliteHive = state.enemies.find(e => e.id === "elite-hive");
    expect(eliteHive).toBeDefined();
    expect(eliteHive?.hp).toBe(500);
  });

  it("should reward 2x scrap for Elite objectives and mission completion", () => {
    const engine = new CoreEngine(
      mockMap,
      1,
      squadConfig,
      true,
      false,
      MissionType.Default,
      false,
      0,
      1.0,
      false,
      undefined,
      [],
      true,
      0,
      3,
      1,
      0,
      "Elite"
    );

    let state = engine.getState();
    const initialScrap = state.stats.scrapGained;

    // 1. Complete a Recover objective
    const recoverObj = state.objectives.find(o => o.kind === "Recover")!;
    (engine as any).state.objectives.find((o: any) => o.id === recoverObj.id).state = "Completed";
    engine.update(16);
    
    state = engine.getState();
    // Standard Recover is 25. Elite is 50.
    expect(state.stats.scrapGained).toBe(initialScrap + 50);

    // 2. Complete Elite Hive objective
    const hiveObj = state.objectives.find(o => o.kind === "Kill")!;
    (engine as any).state.objectives.find((o: any) => o.id === hiveObj.id).state = "Completed";
    engine.update(16);
    
    state = engine.getState();
    // Standard Hive is 75. Elite is 150.
    // Mission win reward: 100 * 2 = 200.
    // Total: 50 + 150 + 200 = 400.
    expect(state.stats.scrapGained).toBe(initialScrap + 400);
    expect(state.status).toBe("Won");
  });
});
