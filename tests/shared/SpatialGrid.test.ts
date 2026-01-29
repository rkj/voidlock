import { describe, it, expect } from "vitest";
import { SpatialGrid } from "@src/shared/utils/SpatialGrid";

describe("SpatialGrid", () => {
  it("should insert and query items correctly", () => {
    const grid = new SpatialGrid<string>();
    grid.insert({ x: 1.5, y: 2.2 }, "item1");
    grid.insert({ x: 1.1, y: 2.9 }, "item2");
    grid.insert({ x: 5.5, y: 6.6 }, "item3");

    expect(grid.queryAt(1, 2)).toEqual(["item1", "item2"]);
    expect(grid.queryAt(5, 6)).toEqual(["item3"]);
    expect(grid.queryAt(0, 0)).toEqual([]);
  });

  it("should query by keys correctly", () => {
    const grid = new SpatialGrid<number>();
    grid.insert({ x: 0, y: 0 }, 100);
    grid.insert({ x: 1, y: 1 }, 200);
    grid.insert({ x: 2, y: 2 }, 300);

    const results = grid.queryByKeys(["0,0", "2,2", "5,5"]);
    expect(results).toContain(100);
    expect(results).toContain(300);
    expect(results).not.toContain(200);
    expect(results.length).toBe(2);
  });

  it("should clear items correctly", () => {
    const grid = new SpatialGrid<string>();
    grid.insert({ x: 1, y: 1 }, "test");
    grid.clear();
    expect(grid.queryAt(1, 1)).toEqual([]);
    expect(grid.getAllItems()).toEqual([]);
  });

  it("should return all items", () => {
    const grid = new SpatialGrid<number>();
    grid.insert({ x: 1, y: 1 }, 1);
    grid.insert({ x: 2, y: 2 }, 2);
    expect(grid.getAllItems().length).toBe(2);
    expect(grid.getAllItems()).toContain(1);
    expect(grid.getAllItems()).toContain(2);
  });
});
