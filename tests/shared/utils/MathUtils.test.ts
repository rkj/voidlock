import { describe, it, expect } from 'vitest';
import { MathUtils } from '@src/shared/utils/MathUtils';

describe('MathUtils', () => {
  describe('getDistance', () => {
    it('should calculate distance between two points', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 3, y: 4 };
      expect(MathUtils.getDistance(p1, p2)).toBe(5);
    });

    it('should handle same points', () => {
      const p1 = { x: 10, y: 10 };
      expect(MathUtils.getDistance(p1, p1)).toBe(0);
    });
  });

  describe('getManhattanDistance', () => {
    it('should calculate Manhattan distance', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 3, y: 4 };
      expect(MathUtils.getManhattanDistance(p1, p2)).toBe(7);
    });
  });

  describe('getDistanceSquared', () => {
    it('should calculate distance squared', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 3, y: 4 };
      expect(MathUtils.getDistanceSquared(p1, p2)).toBe(25);
    });
  });

  describe('clamp', () => {
    it('should clamp value within range', () => {
      expect(MathUtils.clamp(5, 0, 10)).toBe(5);
      expect(MathUtils.clamp(-1, 0, 10)).toBe(0);
      expect(MathUtils.clamp(11, 0, 10)).toBe(10);
    });
  });
});
