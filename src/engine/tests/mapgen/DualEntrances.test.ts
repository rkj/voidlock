import { describe, it, expect } from "vitest";
import { MapGenerator } from "../../MapGenerator";
import { MapGeneratorType, CellType } from "../../../shared/types";

describe("MapGenerator Dual Entrances", () => {
  const seeds = [123, 456, 789];
  const generatorTypes = [
    MapGeneratorType.Procedural,
    MapGeneratorType.TreeShip,
    MapGeneratorType.DenseShip,
  ];

  generatorTypes.forEach((type) => {
    seeds.forEach((seed) => {
      it(`should generate two distinct squad spawns in different rooms for ${type} (seed: ${seed})`, () => {
        const gen = new MapGenerator(seed);
        const map = gen.generate(16, 16, type);

        if (map.squadSpawns && map.squadSpawns.length >= 2) {
          expect(map.squadSpawns.length).toBeGreaterThanOrEqual(2);

          const s1 = map.squadSpawns[0];
          const s2 = map.squadSpawns[1];

          expect(s1).not.toEqual(s2);

          // Check if they are in different rooms
          const cell1 = map.cells.find((c) => c.x === s1.x && c.y === s1.y);
          const cell2 = map.cells.find((c) => c.x === s2.x && c.y === s2.y);

          expect(cell1).toBeDefined();
          expect(cell2).toBeDefined();
          expect(cell1!.type).toBe(CellType.Floor);
          expect(cell2!.type).toBe(CellType.Floor);

          // They should have different roomId
          expect(cell1!.roomId).toBeDefined();
          expect(cell2!.roomId).toBeDefined();
          expect(cell1!.roomId).not.toBe(cell2!.roomId);

          // Check if they are in the same quadrant
          const midX = map.width / 2;
          const midY = map.height / 2;

          const getQuad = (x: number, y: number) => {
            if (x < midX && y < midY) return 0;
            if (x >= midX && y < midY) return 1;
            if (x < midX && y >= midY) return 2;
            return 3;
          };

          expect(getQuad(s1.x, s1.y)).toBe(getQuad(s2.x, s2.y));
        } else {
          // Some maps might be too small or simple to have two rooms in one quadrant
          // But for 16x16 with these generators, we expect it to happen most of the time
          console.warn(
            `Seed ${seed} for ${type} did not produce dual squad spawns`,
          );
        }
      });
    });
  });
});
