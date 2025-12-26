import { describe, it, expect } from "vitest";
import { CoreEngine } from "../CoreEngine";
import { MapDefinition, CellType, SquadConfig, MissionType } from "../../shared/types";

describe("CoreEngine Dual Spawn Splitting", () => {
  it("should split squad members randomly between available squad spawns", () => {
    const map: MapDefinition = {
      width: 10,
      height: 10,
      cells: Array(100).fill(null).map((_, i) => ({
        x: i % 10,
        y: Math.floor(i / 10),
        type: CellType.Floor,
      })),
      squadSpawns: [
        { x: 1, y: 1 },
        { x: 8, y: 8 },
      ],
    };

    const squadConfig: SquadConfig = [
      { archetypeId: "assault", count: 10 },
    ];

    const engine = new CoreEngine(
      map,
      123, // seed
      squadConfig,
      false, // agentControl
      false, // debug
    );

    const units = engine.getState().units;
    expect(units.length).toBe(10);

    const atSpawn1 = units.filter(u => Math.floor(u.pos.x) === 1 && Math.floor(u.pos.y) === 1);
    const atSpawn2 = units.filter(u => Math.floor(u.pos.x) === 8 && Math.floor(u.pos.y) === 8);

    expect(atSpawn1.length).toBeGreaterThan(0);
    expect(atSpawn2.length).toBeGreaterThan(0);
    expect(atSpawn1.length + atSpawn2.length).toBe(10);
  });

  it("should split VIP and squad members in EscortVIP mission", () => {
     const map: MapDefinition = {
      width: 10,
      height: 10,
      cells: Array(100).fill(null).map((_, i) => ({
        x: i % 10,
        y: Math.floor(i / 10),
        type: CellType.Floor,
      })),
      squadSpawns: [
        { x: 1, y: 1 },
        { x: 8, y: 8 },
      ],
    };

    const squadConfig: SquadConfig = [
      { archetypeId: "assault", count: 2 },
    ];

    const engine = new CoreEngine(
      map,
      123, // seed
      squadConfig,
      false, // agentControl
      false, // debug
      MissionType.EscortVIP
    );

    const units = engine.getState().units;
    expect(units.length).toBe(3); // 2 assault + 1 VIP

    const spawns = units.map(u => ({ x: Math.floor(u.pos.x), y: Math.floor(u.pos.y) }));
    
    spawns.forEach(s => {
        expect([{x: 1, y: 1}, {x: 8, y: 8}]).toContainEqual(s);
    });
  });
});
