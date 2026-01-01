import { describe, it, expect } from "vitest";
import { VisibilityPolygon } from "./VisibilityPolygon";
import { Vector2 } from "../shared/types";
import { DenseShipGenerator } from "../engine/generators/DenseShipGenerator";
import { Graph } from "../engine/Graph";

describe("VisibilityPolygon Repro", () => {
  it("should NOT block horizontal ray with the fixed generator segments", () => {
    const seed = 1766364915449;
    const width = 6;
    const height = 6;

    const generator = new DenseShipGenerator(seed, width, height);
    const map = generator.generate(1);
    const graph = new Graph(map);

    const origin = { x: 3.5, y: 2.5 };
    const range = 10;

    const polygon = VisibilityPolygon.compute(origin, graph, range);

    // Check if ANY point in the polygon has reached x < 1 (the target cell) inside the corridor
    const reachedTargetCorridor = polygon.some(
      (p) => p.x < 1 && p.y >= 2 && p.y <= 3,
    );

    expect(reachedTargetCorridor, "LOS should reach cell 0,2").toBe(true);
  });
});
