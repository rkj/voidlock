import { Vector2 } from "../types/geometry";

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

  /**
   * Convert a continuous position to integer cell coordinates
   */
  public static toCellCoord(pos: Vector2): Vector2 {
    return { x: Math.floor(pos.x), y: Math.floor(pos.y) };
  }

  /**
   * Generate a stable string key for a cell position "x,y"
   */
  public static cellKey(pos: Vector2): string {
    return `${Math.floor(pos.x)},${Math.floor(pos.y)}`;
  }

  /**
   * Check if two positions are in the same 1x1 cell
   */
  public static sameCellPosition(pos1: Vector2, pos2: Vector2): boolean {
    return (
      Math.floor(pos1.x) === Math.floor(pos2.x) &&
      Math.floor(pos1.y) === Math.floor(pos2.y)
    );
  }

  /**
   * Generates a deterministic sub-cell offset (jitter) based on an index (e.g., tactical number).
   * Supports up to 9 distinct positions in a 1x1 cell to avoid visual overlap.
   */
  public static getDeterministicJitter(index: number): Vector2 {
    const offsets = [
      { x: -0.2, y: -0.2 }, // 0: Top-Left
      { x: 0.2, y: -0.2 },  // 1: Top-Right
      { x: -0.2, y: 0.2 },  // 2: Bottom-Left
      { x: 0.2, y: 0.2 },   // 3: Bottom-Right
      { x: 0, y: 0 },       // 4: Center
      { x: 0, y: -0.25 },   // 5: Top-Middle
      { x: 0, y: 0.25 },    // 6: Bottom-Middle
      { x: -0.25, y: 0 },   // 7: Left-Middle
      { x: 0.25, y: 0 },    // 8: Right-Middle
    ];
    // We use index % offsets.length but also handle negative if any
    const i = Math.abs(index) % offsets.length;
    return offsets[i];
  }

  /**
   * Returns the center of a cell (0.5, 0.5) adjusted by an optional sub-cell offset (jitter).
   */
  public static getCellCenter(pos: Vector2, jitter?: Vector2): Vector2 {
    return {
      x: Math.floor(pos.x) + 0.5 + (jitter?.x || 0),
      y: Math.floor(pos.y) + 0.5 + (jitter?.y || 0),
    };
  }
}
