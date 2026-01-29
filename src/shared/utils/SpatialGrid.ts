import { Vector2 } from "../types/geometry";

/**
 * A simple spatial grid for partitioning entities by their grid cell coordinates.
 * This allows for efficient querying of entities within specific cells.
 */
export class SpatialGrid<T> {
  private cells: Map<string, T[]> = new Map();

  /**
   * Clears the grid.
   */
  public clear(): void {
    this.cells.clear();
  }

  /**
   * Inserts an item into the grid at the specified position.
   * The position is rounded down to the nearest integer coordinates.
   */
  public insert(pos: Vector2, item: T): void {
    const key = this.getCellKey(pos);
    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    cell.push(item);
  }

  /**
   * Queries the grid for all items in the specified cells.
   * @param cellKeys Array of cell keys in "x,y" format.
   */
  public queryByKeys(cellKeys: string[]): T[] {
    const results: T[] = [];
    for (const key of cellKeys) {
      const cell = this.cells.get(key);
      if (cell) {
        results.push(...cell);
      }
    }
    return results;
  }

  /**
   * Queries the grid for items at a specific cell coordinate.
   */
  public queryAt(x: number, y: number): T[] {
    return this.cells.get(`${x},${y}`) || [];
  }

  /**
   * Returns the key for a given position.
   */
  private getCellKey(pos: Vector2): string {
    return `${Math.floor(pos.x)},${Math.floor(pos.y)}`;
  }

  /**
   * Returns all items in the grid.
   */
  public getAllItems(): T[] {
    const all: T[] = [];
    for (const cell of this.cells.values()) {
      all.push(...cell);
    }
    return all;
  }
}
