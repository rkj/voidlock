import { describe, it, expect } from "vitest";
import { SpaceshipGenerator } from "@src/engine/generators/SpaceshipGenerator";
import { CellType, MapGeneratorType, BoundaryType } from "@src/shared/types";
import { MapGenerator } from "@src/engine/MapGenerator";
import { Graph, Direction } from "@src/engine/Graph";
import { PRNG } from "@src/shared/PRNG";

describe("SpaceshipGenerator", () => {
  it("should generate a valid map with connected corridors and rooms", () => {
    const generator = new SpaceshipGenerator(12345, 32, 32);
    const map = generator.generate();

    expect(map.width).toBe(32);
    expect(map.height).toBe(32);

    const floors = map.cells.filter((c) => c.type === CellType.Floor);
    expect(floors.length).toBeGreaterThan(20); // Should have content

    // Check features
    expect(map.spawnPoints?.length).toBeGreaterThan(0);
    expect(map.extraction).toBeDefined();
    expect(map.objectives?.length).toBeGreaterThan(0);
    expect(map.doors?.length).toBeGreaterThan(0); // Should have doors for rooms
  });

  it("should generate a fully connected map for 100 random seeds (strict check)", () => {
    for (let i = 0; i < 100; i++) {
      const seed = 20000 + i;
      const prng = new PRNG(seed);
      const width = prng.nextInt(16, 48);
      const height = prng.nextInt(16, 48);
      const generator = new SpaceshipGenerator(seed, width, height);
      const map = generator.generate();

      const squadStart = map.squadSpawn || (map.squadSpawns && map.squadSpawns[0]);
      expect(squadStart, `Seed ${seed} has no squad spawn`).toBeDefined();
      if (!squadStart) continue;

      const visited = new Set<string>();
      const queue: { x: number; y: number }[] = [squadStart];
      visited.add(`${squadStart.x},${squadStart.y}`);

      const graph = new MapGenerator({ seed, width, height, type: MapGeneratorType.Procedural }).load(map);
      const g = new Graph(graph);

      let head = 0;
      while (head < queue.length) {
        const { x, y } = queue[head++];
        const cell = g.cells[y][x];

        const dirs: { dx: number; dy: number; d: Direction }[] = [
          { dx: 0, dy: -1, d: "n" },
          { dx: 1, dy: 0, d: "e" },
          { dx: 0, dy: 1, d: "s" },
          { dx: -1, dy: 0, d: "w" }
        ];

        for (const { dx, dy, d } of dirs) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

          const boundary = cell.edges[d];
          if (boundary && (boundary.type === BoundaryType.Open || boundary.type === BoundaryType.Door)) {
            const nKey = `${nx},${ny}`;
            if (!visited.has(nKey)) {
              const nCell = g.cells[ny][nx];
              if (nCell.type === CellType.Floor) {
                visited.add(nKey);
                queue.push({ x: nx, y: ny });
              }
            }
          }
        }
      }

      const totalFloors = map.cells.length;
      expect(visited.size, `Seed ${seed} produced disconnected map: reachable ${visited.size} / total ${totalFloors}`).toBe(totalFloors);
    }
  });

  it("should generate a fully connected map for seed 139801 (regression)", () => {
    const seed = 139801;
    const width = 16;
    const height = 16;
    const generator = new SpaceshipGenerator(seed, width, height);
    const map = generator.generate();

    const mg = new MapGenerator({ seed, width, height, type: MapGeneratorType.Procedural });
    const validation = mg.validate(map);
    
    expect(validation.isValid, `Seed ${seed} produced invalid map:\n${validation.issues.join("\n")}`).toBe(true);
  });

  it("should generate a fully connected map for seed 785411 (broken_map repro)", () => {
    const seed = 785411;
    const width = 16;
    const height = 16;
    const generator = new SpaceshipGenerator(seed, width, height);
    const map = generator.generate();

    const mg = new MapGenerator({ seed, width, height, type: MapGeneratorType.Procedural });
    const validation = mg.validate(map);
    
    expect(validation.isValid, `Seed ${seed} produced invalid map:\n${validation.issues.join("\n")}`).toBe(true);
  });
});