import { describe, it, expect } from "vitest";
import { MapGenerator } from "@src/engine/MapGenerator";
import { MapGeneratorType, CellType } from "@src/shared/types";

describe("MapGenerator Quadrant Distribution", () => {
  const seeds = [123, 456, 789, 101112];
  const generatorTypes = [
    MapGeneratorType.Procedural,
    MapGeneratorType.TreeShip,
    MapGeneratorType.DenseShip,
  ];

  generatorTypes.forEach((type) => {
    describe(`Generator: ${type}`, () => {
      seeds.forEach((seed) => {
        it(`should place squadSpawn and extraction in different quadrants for seed ${seed}`, () => {
          const generator = new MapGenerator(seed);
          const width = 16;
          const height = 16;
          const map = generator.generate(width, height, type);

          expect(map.squadSpawn).toBeDefined();
          expect(map.extraction).toBeDefined();

          const ss = map.squadSpawn!;
          const ex = map.extraction!;

          const midX = width / 2;
          const midY = height / 2;

          const getQuadrant = (pos: { x: number; y: number }) => {
            if (pos.x < midX && pos.y < midY) return 0;
            if (pos.x >= midX && pos.y < midY) return 1;
            if (pos.x < midX && pos.y >= midY) return 2;
            return 3;
          };

          const ssQuad = getQuadrant(ss);
          const exQuad = getQuadrant(ex);

          expect(ssQuad).not.toBe(exQuad);

          // Verify they are on Floor cells
          const ssCell = map.cells[ss.y * width + ss.x];
          const exCell = map.cells[ex.y * width + ex.x];
          expect(ssCell.type).toBe(CellType.Floor);
          expect(exCell.type).toBe(CellType.Floor);
        });
      });
    });
  });
});
