import { describe, it, expect } from "vitest";
import { MathUtils } from "@src/shared/utils/MathUtils";

describe("MathUtils Debug", () => {
  it("should calculate distance correctly", () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 3, y: 4 };
    expect(MathUtils.getDistance(p1, p2)).toBe(5);
  });

  it("should calculate manhattan distance correctly", () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 3, y: 4 };
    expect(MathUtils.getManhattanDistance(p1, p2)).toBe(7);
  });
});
