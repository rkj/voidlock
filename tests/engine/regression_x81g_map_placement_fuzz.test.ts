import { describe, it, expect } from "vitest";
import { MapGenerator } from "@src/engine/MapGenerator";
import { MapGeneratorType, MapDefinition, CellType } from "@src/shared/types";
import { Graph } from "@src/engine/Graph";

describe("Map Placement Fuzzing (voidlock-gemini-x81g)", () => {
  const seeds = Array.from({ length: 100 }, (_, i) => i + 1000);
  const generatorTypes = [
    MapGeneratorType.Procedural,
    MapGeneratorType.TreeShip,
    MapGeneratorType.DenseShip,
  ];

  generatorTypes.forEach((genType) => {
    describe(`Generator: ${genType}`, () => {
      seeds.forEach((seed) => {
        const width = 3 + (seed % 8); // 3x3 to 10x10
        const height = 3 + ((seed + 1) % 8);

        it(`should have valid entity placement for seed ${seed} (${width}x${height})`, () => {
          const generator = new MapGenerator({
            seed,
            width,
            height,
            type: genType,
          });
          const map = generator.generate();

          assertPlacementRules(map, width, height);
        });
      });
    });
  });
});

function assertPlacementRules(
  map: MapDefinition,
  width: number,
  height: number,
) {
  const generator = new MapGenerator({
    seed: 0,
    width,
    height,
    type: MapGeneratorType.Procedural,
  });
  const result = generator.validate(map);

  if (!result.isValid) {
    throw new Error(
      `Validation failed for ${width}x${height} map:\n${result.issues.join("\n")}`,
    );
  }
}
