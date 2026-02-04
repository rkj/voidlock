import { describe, it, expect } from "vitest";
import { Director } from "@src/engine/Director";
import { PRNG } from "@src/shared/PRNG";
import { CellType, MapGeneratorType } from "@src/shared/types";
import { MapFactory } from "@src/engine/map/MapFactory";

describe("Regression voidlock-ew59: Point-Based Spawning", () => {
  it("should verify multiple distinct 1x1 squad spawn points", () => {
    const map = MapFactory.generate({
      seed: 12345,
      width: 16,
      height: 16,
      type: MapGeneratorType.DenseShip,
    });

    expect(map.squadSpawns).toBeDefined();
    expect(map.squadSpawns!.length).toBeGreaterThanOrEqual(2);

    const seen = new Set<string>();
    map.squadSpawns!.forEach((ss) => {
      const key = `${ss.x},${ss.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);

      const cell = map.cells.find((c) => c.x === ss.x && c.y === ss.y);
      expect(cell).toBeDefined();
      expect(cell?.type).toBe(CellType.Floor);
      expect(cell?.roomId).toBeDefined();
      expect(cell?.roomId?.startsWith("room-")).toBe(true);
    });
  });

  it("should verify pre-spawning logic (Rooms only, Point Budget, Safety Quadrant)", () => {
    const width = 16;
    const height = 16;
    const map = MapFactory.generate({
      seed: 12345,
      width,
      height,
      type: MapGeneratorType.DenseShip,
    });

    const prng = new PRNG(12345);
    const spawnedEnemies: any[] = [];
    const onSpawn = (enemy: any) => spawnedEnemies.push(enemy);

    const startingPoints = 20;

    const director = new Director(
      map.spawnPoints!,
      prng,
      onSpawn,
      0, // startingThreatLevel
      map,
      startingPoints,
    );

    director.preSpawn();

    expect(spawnedEnemies.length).toBeGreaterThan(0);

    let totalPoints = 0;
    spawnedEnemies.forEach((enemy) => {
      totalPoints += enemy.difficulty;

      const ex = Math.floor(enemy.pos.x);
      const ey = Math.floor(enemy.pos.y);

      // 1. All enemies are in a room (not corridor)
      const cell = map.cells.find((c) => c.x === ex && c.y === ey);
      expect(cell).toBeDefined();
      expect(
        cell?.roomId,
        `Enemy at (${ex}, ${ey}) has no roomId`,
      ).toBeDefined();
      expect(
        cell?.roomId?.startsWith("room-"),
        `Enemy at (${ex}, ${ey}) is in roomId ${cell?.roomId} (not a room)`,
      ).toBe(true);
      expect(cell?.roomId?.startsWith("corridor-")).toBe(false);

      // 2. All enemies are NOT in the player's quadrant
      const midX = width / 2;
      const midY = height / 2;
      const getQuadrant = (pos: { x: number; y: number }) => {
        if (pos.x < midX && pos.y < midY) return 0;
        if (pos.x >= midX && pos.y < midY) return 1;
        if (pos.x < midX && pos.y >= midY) return 2;
        return 3;
      };

      const enemyQuad = getQuadrant({ x: ex, y: ey });

      map.squadSpawns?.forEach((ss) => {
        const squadQuad = getQuadrant(ss);
        expect(
          enemyQuad,
          `Enemy at (${ex}, ${ey}) in quad ${enemyQuad} same as squad spawn quad ${squadQuad}`,
        ).not.toBe(squadQuad);
      });
      if (map.squadSpawn) {
        const squadQuad = getQuadrant(map.squadSpawn);
        expect(
          enemyQuad,
          `Enemy at (${ex}, ${ey}) in quad ${enemyQuad} same as squad spawn quad ${squadQuad}`,
        ).not.toBe(squadQuad);
      }
    });

    expect(totalPoints).toBeLessThanOrEqual(startingPoints);
    expect(totalPoints).toBeGreaterThanOrEqual(startingPoints - 3);
  });
});
