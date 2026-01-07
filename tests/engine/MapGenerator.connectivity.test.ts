import { describe, it, expect } from "vitest";
import { MapGenerator } from "@src/engine/MapGenerator";
import { SpaceshipGenerator } from "@src/engine/generators/SpaceshipGenerator";
import { TreeShipGenerator } from "@src/engine/generators/TreeShipGenerator";
import {
  CellType,
  MapDefinition,
  BoundaryType,
  MapGeneratorType,
} from "@src/shared/types";
import { Graph } from "@src/engine/Graph";

describe("MapGenerator Connectivity Guarantee", () => {
  const checkConnectivity = (
    map: MapDefinition,
    seed: number,
    genName: string,
  ) => {
    const validator = new MapGenerator({
      seed: 0,
      width: map.width,
      height: map.height,
      type: MapGeneratorType.Procedural,
    });
    const result = validator.validate(map);
    expect(
      result.isValid,
      `${genName} seed ${seed} failed validation: ${result.issues.join(", ")}`,
    ).toBe(true);

    const graph = new Graph(map);
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const cell = graph.cells[y][x];
        if (cell.type !== CellType.Floor) continue;

        const dirs = ["n", "e", "s", "w"] as const;
        for (const d of dirs) {
          const b = cell.edges[d];
          if (b && b.type === BoundaryType.Open) {
            const nx = d === "e" ? x + 1 : d === "w" ? x - 1 : x;
            const ny = d === "s" ? y + 1 : d === "n" ? y - 1 : y;

            if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) {
              expect.fail(
                `${genName} seed ${seed}: Cell ${x},${y} is open ${d} to map edge (Void)`,
              );
            }
            const neighbor = graph.cells[ny][nx];
            expect(
              neighbor.type,
              `${genName} seed ${seed}: Cell ${x},${y} is open ${d} to Void cell ${nx},${ny}`,
            ).toBe(CellType.Floor);
          }
        }
      }
    }
  };

  it("MapGenerator: should never generate unreachable Floor cells or open to Void", () => {
    for (let i = 0; i < 50; i++) {
      const generator = new MapGenerator({
        seed: i,
        width: 16,
        height: 16,
        type: MapGeneratorType.Procedural,
      });
      const map = generator.generate();
      checkConnectivity(map, i, "MapGenerator");
    }
  });

  it("SpaceshipGenerator: should never generate unreachable Floor cells or open to Void", () => {
    for (let i = 0; i < 50; i++) {
      const generator = new SpaceshipGenerator(i, 32, 32);
      const map = generator.generate();
      checkConnectivity(map, i, "SpaceshipGenerator");
    }
  });

  it("TreeShipGenerator: should never generate unreachable Floor cells or open to Void", () => {
    for (let i = 0; i < 50; i++) {
      const generator = new TreeShipGenerator(i, 16, 16);
      const map = generator.generate();
      checkConnectivity(map, i, "TreeShipGenerator");
    }
  });
});
