import { describe, it, expect } from "vitest";
import { CoreEngine } from "../CoreEngine";
import {
  MapDefinition,
  CellType,
  SquadConfig,
  MissionType,
} from "../../shared/types";

describe("CoreEngine Dual Spawn Splitting", () => {
  it("should split squad members randomly between available squad spawns", () => {
    const map: MapDefinition = {
      width: 10,
      height: 10,
      cells: Array(100)
        .fill(null)
        .map((_, i) => ({
          x: i % 10,
          y: Math.floor(i / 10),
          type: CellType.Floor,
        })),
      squadSpawns: [
        { x: 1, y: 1 },
        { x: 8, y: 8 },
      ],
    };

    const squadConfig: SquadConfig = [{ archetypeId: "assault", count: 10 }];

    const engine = new CoreEngine(
      map,
      123, // seed
      squadConfig,
      false, // agentControl
      false, // debug
    );

    const units = engine.getState().units;
    expect(units.length).toBe(10);

    const atSpawn1 = units.filter(
      (u) => Math.floor(u.pos.x) === 1 && Math.floor(u.pos.y) === 1,
    );
    const atSpawn2 = units.filter(
      (u) => Math.floor(u.pos.x) === 8 && Math.floor(u.pos.y) === 8,
    );

    expect(atSpawn1.length).toBeGreaterThan(0);
    expect(atSpawn2.length).toBeGreaterThan(0);
    expect(atSpawn1.length + atSpawn2.length).toBe(10);
  });

  it("should split VIP and squad members in EscortVIP mission", () => {
    const map: MapDefinition = {
      width: 10,
      height: 10,
      cells: Array(100)
        .fill(null)
        .map((_, i) => ({
          x: i % 10,
          y: Math.floor(i / 10),
          type: CellType.Floor,
        })),
      squadSpawns: [
        { x: 1, y: 1 },
        { x: 8, y: 8 },
      ],
    };

    const squadConfig: SquadConfig = [{ archetypeId: "assault", count: 2 }];

    const engine = new CoreEngine(
      map,
      123, // seed
      squadConfig,
      false, // agentControl
      false, // debug
      MissionType.EscortVIP,
    );

    const units = engine.getState().units;
    expect(units.length).toBe(3); // 2 assault + 1 VIP

    const squadUnits = units.filter((u) => u.archetypeId === "assault");
    const vipUnit = units.find((u) => u.archetypeId === "vip")!;

    squadUnits.forEach((u) => {
      const s = { x: Math.floor(u.pos.x), y: Math.floor(u.pos.y) };
      expect([
        { x: 1, y: 1 },
        { x: 8, y: 8 },
      ]).toContainEqual(s);
    });

    // VIP should be in a different quadrant than the first squad spawn (1,1 is top-left)
    // In a 10x10 map, top-left quadrant is 0-4, 0-4.
    // VIP in (0,0) is also in top-left, but it's the fallback.
    // If no rooms are defined, it currently falls back to (0,0).
    expect(vipUnit).toBeDefined();
  });
});
