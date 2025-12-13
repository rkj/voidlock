import { describe, it, expect, beforeEach } from 'vitest';
import { GameGrid } from './GameGrid';
import { MapDefinition, CellType, Cell } from '../shared/types';

describe('GameGrid', () => {
  let mockMap: MapDefinition;
  let grid: GameGrid;

  beforeEach(() => {
    // 2x2 map. (0,0) and (1,0) connected. (0,1) disconnected from (0,0) by wall.
    const cells: Cell[] = [
      { x: 0, y: 0, type: CellType.Floor, walls: { n: true, e: false, s: true, w: true } },
      { x: 1, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: false } }, // w: false connects to (0,0) e: false? No e: false connects.
      
      { x: 0, y: 1, type: CellType.Floor, walls: { n: true, e: true, s: true, w: true } }, // Isolated
      { x: 1, y: 1, type: CellType.Wall, walls: { n: true, e: true, s: true, w: true } }
    ];

    mockMap = {
      width: 2,
      height: 2,
      cells
    };
    grid = new GameGrid(mockMap);
  });

  it('should allow movement between open edges', () => {
    // (0,0) -> (1,0). (0,0).walls.e is false. (1,0).walls.w is false.
    expect(grid.canMove(0, 0, 1, 0)).toBe(true);
    expect(grid.canMove(1, 0, 0, 0)).toBe(true);
  });

  it('should block movement through walls', () => {
    // (0,0) -> (0,1). (0,0).walls.s is true.
    expect(grid.canMove(0, 0, 0, 1)).toBe(false);
  });

  it('should block movement to void/wall cells', () => {
    // (1,0) -> (1,1). (1,1) is Wall type.
    expect(grid.canMove(1, 0, 1, 1)).toBe(false);
  });
});