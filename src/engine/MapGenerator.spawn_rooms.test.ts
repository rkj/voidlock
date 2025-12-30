import { describe, it, expect } from "vitest";
import { MapGenerator } from "./MapGenerator";
import { MapGeneratorType, CellType } from "../shared/types";

describe("MapGenerator - Spawn Room Exclusivity", () => {
  const seeds = [123, 456, 789, 101112, 131415];
  const generatorTypes = [
    MapGeneratorType.DenseShip,
    MapGeneratorType.TreeShip,
    MapGeneratorType.Procedural,
  ];

  generatorTypes.forEach((type) => {
    describe(`Generator Type: ${type}`, () => {
      seeds.forEach((seed) => {
        it(`should never place squad and enemy spawns in the same room (seed: ${seed})`, () => {
          const generator = new MapGenerator(seed);
          const map = generator.generate(16, 16, type, 5);

          const validation = generator.validate(map);
          expect(
            validation.isValid,
            `Map validation failed: ${validation.issues.join(", ")}`,
          ).toBe(true);

          const squadRooms = new Set<string>();
          if (map.squadSpawn) {
            const cell = map.cells.find(
              (c) => c.x === map.squadSpawn!.x && c.y === map.squadSpawn!.y,
            );
            if (cell?.roomId) squadRooms.add(cell.roomId);
          }
          if (map.squadSpawns) {
            map.squadSpawns.forEach((ss) => {
              const cell = map.cells.find((c) => c.x === ss.x && c.y === ss.y);
              if (cell?.roomId) squadRooms.add(cell.roomId);
            });
          }

          if (map.spawnPoints) {
            map.spawnPoints.forEach((sp) => {
              const cell = map.cells.find(
                (c) => c.x === sp.pos.x && c.y === sp.pos.y,
              );
              expect(
                cell?.roomId,
                `Enemy spawn point ${sp.id} at (${sp.pos.x}, ${sp.pos.y}) is not in a room`,
              ).toBeDefined();
              expect(
                cell?.roomId?.startsWith("room-"),
                `Enemy spawn point ${sp.id} at (${sp.pos.x}, ${sp.pos.y}) is in a corridor: ${cell?.roomId}`,
              ).toBe(true);
              expect(
                squadRooms.has(cell!.roomId!),
                `Enemy spawn point ${sp.id} is in squad room: ${cell?.roomId}`,
              ).toBe(false);
            });
          }

          if (map.squadSpawn) {
            const cell = map.cells.find(
              (c) => c.x === map.squadSpawn!.x && c.y === map.squadSpawn!.y,
            );
            expect(
              cell?.roomId,
              "Squad spawn point is not in a room",
            ).toBeDefined();
            expect(
              cell?.roomId?.startsWith("room-"),
              `Squad spawn point is in a corridor: ${cell?.roomId}`,
            ).toBe(true);
          }

          if (map.objectives) {
            map.objectives.forEach((obj) => {
              if (obj.targetCell) {
                const cell = map.cells.find(
                  (c) => c.x === obj.targetCell!.x && c.y === obj.targetCell!.y,
                );
                expect(
                  cell?.roomId,
                  `Objective ${obj.id} at (${obj.targetCell!.x}, ${obj.targetCell!.y}) is not in a room`,
                ).toBeDefined();
                expect(
                  cell?.roomId?.startsWith("room-"),
                  `Objective ${obj.id} at (${obj.targetCell!.x}, ${obj.targetCell!.y}) is in a corridor: ${cell?.roomId}`,
                ).toBe(true);
              }
            });
          }
        });
      });
    });
  });
});
