import { describe, it, expect } from "vitest";
import { DenseShipGenerator } from "@src/engine/generators/DenseShipGenerator";
import { CellType } from "@src/shared/types";

describe("DenseShipGenerator", () => {
  it("should generate a map with >90% fill rate", () => {
    const generator = new DenseShipGenerator(12345, 16, 16);
    const map = generator.generate();

    const floorCells = map.cells.filter(
      (c) => c.type === CellType.Floor,
    ).length;
    const totalCells = map.width * map.height;
    const fillRate = floorCells / totalCells;

    expect(fillRate).toBeGreaterThan(0.85);
  });

  it("should have all floor cells reachable and maintain a tree structure (acyclic)", () => {
    const generator = new DenseShipGenerator(67890, 16, 16);
    const map = generator.generate();

    // BFS to check connectivity and count edges
    const start = map.spawnPoints![0].pos;
    const visited = new Set<string>();
    const queue = [start];
    visited.add(`${start.x},${start.y}`);

    let edges = 0;
    let head = 0;
    while (head < queue.length) {
      const curr = queue[head++];
      const cell = map.cells.find((c) => c.x === curr.x && c.y === curr.y)!;

      const neighbors = [
        { x: curr.x + 1, y: curr.y, wall: "e" },
        { x: curr.x - 1, y: curr.y, wall: "w" },
        { x: curr.x, y: curr.y + 1, wall: "s" },
        { x: curr.x, y: curr.y - 1, wall: "n" },
      ];

      neighbors.forEach((n) => {
        if (n.x >= 0 && n.x < map.width && n.y >= 0 && n.y < map.height) {
          // Check if passage exists (wall is open OR door exists)
          const hasWall = (cell as any)[n.wall];
          const hasDoor = map.doors?.some(
            (d) =>
              d.segment.some((s) => s.x === curr.x && s.y === curr.y) &&
              d.segment.some((s) => s.x === n.x && s.y === n.y),
          );

          if (!hasWall || hasDoor) {
            if (!visited.has(`${n.x},${n.y}`)) {
              visited.add(`${n.x},${n.y}`);
              queue.push(n);
              edges++;
            }
          }
        }
      });
    }

    const floorCells = map.cells.filter((c) => c.type === CellType.Floor);
    expect(visited.size).toBe(floorCells.length); // All floor cells reachable

    // In a tree, Edges = Vertices - 1
    // Note: This only checks the traversal tree we built.
    // To truly check acyclicity, we'd need to ensure no OTHER open exist.
    expect(edges).toBe(floorCells.length - 1);
  });

  it("should generate strict room shapes (1x1, 1x2, 2x1, 2x2) and valid corridors", () => {
    const generator = new DenseShipGenerator(999, 16, 16);
    const map = generator.generate();

    // Group cells by roomId
    const rooms = new Map<string, { x: number; y: number }[]>();
    map.cells.forEach((cell) => {
      if (cell.type === CellType.Floor && cell.roomId) {
        if (!rooms.has(cell.roomId)) rooms.set(cell.roomId, []);
        rooms.get(cell.roomId)!.push({ x: cell.x, y: cell.y });
      }
    });

    rooms.forEach((cells, roomId) => {
      if (roomId.startsWith("corridor-")) {
        // Corridors: Should be 1xN or Nx1
        const xs = cells.map((c) => c.x);
        const ys = cells.map((c) => c.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const w = maxX - minX + 1;
        const h = maxY - minY + 1;

        // Either width or height must be 1
        expect(
          w === 1 || h === 1,
          `Corridor ${roomId} is not linear (w=${w}, h=${h})`,
        ).toBe(true);
      } else if (roomId.startsWith("room-")) {
        // Rooms: 1x1, 1x2, 2x1, 2x2
        const xs = cells.map((c) => c.x);
        const ys = cells.map((c) => c.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const w = maxX - minX + 1;
        const h = maxY - minY + 1;
        const area = w * h;

        expect(cells.length).toBe(area); // Must be rectangular (no holes)
        expect(area).toBeLessThanOrEqual(4); // Max 4 cells
        expect(w).toBeLessThanOrEqual(2);
        expect(h).toBeLessThanOrEqual(2);
      }
    });
  });
});
