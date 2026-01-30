import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../../src/engine/CoreEngine";
import { MapDefinition, MissionType, SquadConfig, EngineMode } from "../../src/shared/types";

describe("CoreEngine getState Benchmark", () => {
  let map: MapDefinition;
  let squadConfig: SquadConfig;

  beforeEach(() => {
    map = {
      width: 50,
      height: 50,
      cells: [],
      spawnPoints: [{ id: "sp-1", pos: { x: 1, y: 1 }, radius: 1 }],
      squadSpawn: { x: 2, y: 2 },
      extraction: { x: 48, y: 48 },
      doors: [],
    };
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 50; x++) {
        map.cells.push({ x, y, type: "Floor" as any, roomId: "room-1" });
      }
    }
    squadConfig = {
      soldiers: [
        { id: "1", archetypeId: "assault", name: "A", equipment: {} },
        { id: "2", archetypeId: "medic", name: "B", equipment: {} },
        { id: "3", archetypeId: "scout", name: "C", equipment: {} },
        { id: "4", archetypeId: "heavy", name: "D", equipment: {} },
      ],
      inventory: {},
    } as any;
  });

  it("should measure getState performance with many entities", () => {
    const engine = new CoreEngine(map, 123, squadConfig, false, false);
    
    // Add many enemies
    for (let i = 0; i < 100; i++) {
      engine.addEnemy({
        id: `enemy-${i}`,
        type: "XenoMite" as any,
        pos: { x: 10 + (i % 30), y: 10 + Math.floor(i / 30) },
        hp: 10,
        maxHp: 10,
        damage: 1,
        speed: 1,
        accuracy: 50,
        fireRate: 1000,
        attackRange: 1,
        difficulty: 1,
      });
    }

    // Add many loot
    for (let i = 0; i < 100; i++) {
        // @ts-ignore - access private state for testing
        engine.state.loot.push({
            id: `loot-${i}`,
            itemId: "scrap_crate",
            pos: { x: 5, y: 5 },
        });
    }

    const start = performance.now();
    const iterations = 1000;
    for (let i = 0; i < iterations; i++) {
      engine.getState();
    }
    const end = performance.now();
    console.log(`getState (${iterations} iterations) took ${end - start}ms`);
    console.log(`Average getState time: ${(end - start) / iterations}ms`);
  });
});