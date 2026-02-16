import { describe, it, expect } from "vitest";
import { MathUtils } from "@src/shared/utils/MathUtils";

describe("MathUtils", () => {
  describe("getDistance", () => {
    it("should calculate distance between two points", () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 3, y: 4 };
      expect(MathUtils.getDistance(p1, p2)).toBe(5);
    });

    it("should handle same points", () => {
      const p1 = { x: 10, y: 10 };
      expect(MathUtils.getDistance(p1, p1)).toBe(0);
    });
  });

  describe("getManhattanDistance", () => {
    it("should calculate Manhattan distance", () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 3, y: 4 };
      expect(MathUtils.getManhattanDistance(p1, p2)).toBe(7);
    });
  });

  describe("getDistanceSquared", () => {
    it("should calculate distance squared", () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 3, y: 4 };
      expect(MathUtils.getDistanceSquared(p1, p2)).toBe(25);
    });
  });

  describe("clamp", () => {
    it("should clamp value within range", () => {
      expect(MathUtils.clamp(5, 0, 10)).toBe(5);
      expect(MathUtils.clamp(-1, 0, 10)).toBe(0);
      expect(MathUtils.clamp(11, 0, 10)).toBe(10);
    });
  });

  describe("toCellCoord", () => {
    it("should floor x and y coordinates", () => {
      expect(MathUtils.toCellCoord({ x: 1.2, y: 3.9 })).toEqual({ x: 1, y: 3 });
      expect(MathUtils.toCellCoord({ x: 5.0, y: 0.1 })).toEqual({ x: 5, y: 0 });
    });
  });

  describe("cellKey", () => {
    it("should return stable string key", () => {
      expect(MathUtils.cellKey({ x: 1.2, y: 3.9 })).toBe("1,3");
      expect(MathUtils.cellKey({ x: 5.0, y: 0.1 })).toBe("5,0");
    });
  });

  describe("sameCellPosition", () => {
    it("should return true if positions floor to same cell", () => {
      const p1 = { x: 1.2, y: 3.9 };
      const p2 = { x: 1.8, y: 3.1 };
      expect(MathUtils.sameCellPosition(p1, p2)).toBe(true);
    });

    it("should return false if positions floor to different cells", () => {
      const p1 = { x: 1.2, y: 3.9 };
      const p2 = { x: 2.2, y: 3.9 };
      expect(MathUtils.sameCellPosition(p1, p2)).toBe(false);
    });
  });
});
