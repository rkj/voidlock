import { describe, it, expect, beforeEach } from 'vitest';
import { GameGrid } from './GameGrid';
import { MapDefinition, CellType } from '../shared/types';

describe('GameGrid', () => {
  let mockMap: MapDefinition;
  let grid: GameGrid;

  beforeEach(() => {
    mockMap = {
      width: 5,
      height: 5,
      cells: [
        { x: 0, y: 0, type: CellType.Wall },
        { x: 1, y: 0, type: CellType.Floor },
        { x: 2, y: 0, type: CellType.Floor },
        { x: 3, y: 0, type: CellType.Wall },
        { x: 4, y: 0, type: CellType.Floor },
        
        { x: 0, y: 1, type: CellType.Floor },
        { x: 1, y: 1, type: CellType.Floor },
        { x: 2, y: 1, type: CellType.Floor },
        { x: 3, y: 1, type: CellType.Floor },
        { x: 4, y: 1, type: CellType.Floor },

        { x: 0, y: 2, type: CellType.Wall },
        { x: 1, y: 2, type: CellType.Wall },
        { x: 2, y: 2, type: CellType.Floor },
        { x: 3, y: 2, type: CellType.Wall },
        { x: 4, y: 2, type: CellType.Wall },

        { x: 0, y: 3, type: CellType.Floor },
        { x: 1, y: 3, type: CellType.Floor },
        { x: 2, y: 3, type: CellType.Floor },
        { x: 3, y: 3, type: CellType.Floor },
        { x: 4, y: 3, type: CellType.Floor },

        { x: 0, y: 4, type: CellType.Floor },
        { x: 1, y: 4, type: CellType.Floor },
        { x: 2, y: 4, type: CellType.Floor },
        { x: 3, y: 4, type: CellType.Floor },
        { x: 4, y: 4, type: CellType.Floor },
      ],
    };
    grid = new GameGrid(mockMap);
  });

  it('should initialize with correct dimensions', () => {
    expect(grid.width).toBe(mockMap.width);
    expect(grid.height).toBe(mockMap.height);
  });

  it('should correctly identify walkable cells', () => {
    expect(grid.isWalkable(1, 0)).toBe(true); // Floor
    expect(grid.isWalkable(0, 0)).toBe(false); // Wall
    expect(grid.isWalkable(3, 0)).toBe(false); // Wall
    expect(grid.isWalkable(1, 2)).toBe(false); // Wall
    expect(grid.isWalkable(2, 2)).toBe(true); // Floor
  });

  it('should return false for out-of-bounds cells', () => {
    expect(grid.isWalkable(-1, 0)).toBe(false);
    expect(grid.isWalkable(5, 0)).toBe(false);
    expect(grid.isWalkable(0, -1)).toBe(false);
    expect(grid.isWalkable(0, 5)).toBe(false);
  });
});
