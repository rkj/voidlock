import { Vector2 } from '../types/geometry';

export class MathUtils {
  /**
   * Calculate Euclidean distance between two points
   */
  public static getDistance(pos1: Vector2, pos2: Vector2): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate Manhattan distance (grid distance)
   */
  public static getManhattanDistance(pos1: Vector2, pos2: Vector2): number {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
  }

  /**
   * Calculate squared distance (faster, no sqrt)
   */
  public static getDistanceSquared(pos1: Vector2, pos2: Vector2): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return dx * dx + dy * dy;
  }

  /**
   * Clamp a value between min and max
   */
  public static clamp(val: number, min: number, max: number): number {
    return Math.min(Math.max(val, min), max);
  }
}
