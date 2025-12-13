import { describe, it, expect, beforeEach } from 'vitest';
import { Pathfinder } from './Pathfinder';
import { GameGrid } from './GameGrid';
import { MapDefinition, CellType, Vector2 } from '../shared/types';

describe('Pathfinder', () => {
  let mockMap: MapDefinition;
  let gameGrid: GameGrid;
  let pathfinder: Pathfinder;

  beforeEach(() => {
    mockMap = {
      width: 5,
      height: 5,
      cells: [
        { x: 0, y: 0, type: CellType.Floor }, { x: 1, y: 0, type: CellType.Floor }, { x: 2, y: 0, type: CellType.Floor }, { x: 3, y: 0, type: CellType.Floor }, { x: 4, y: 0, type: CellType.Floor },
        { x: 0, y: 1, type: CellType.Floor }, { x: 1, y: 1, type: CellType.Wall  }, { x: 2, y: 1, type: CellType.Floor }, { x: 3, y: 1, type: CellType.Wall  }, { x: 4, y: 1, type: CellType.Floor },
        { x: 0, y: 2, type: CellType.Floor }, { x: 1, y: 2, type: CellType.Wall  }, { x: 2, y: 2, type: CellType.Floor }, { x: 3, y: 2, type: CellType.Wall  }, { x: 4, y: 2, type: CellType.Floor },
        { x: 0, y: 3, type: CellType.Floor }, { x: 1, y: 3, type: CellType.Wall  }, { x: 2, y: 3, type: CellType.Floor }, { x: 3, y: 3, type: CellType.Wall  }, { x: 4, y: 3, type: CellType.Floor },
        { x: 0, y: 4, type: CellType.Floor }, { x: 1, y: 4, type: CellType.Floor }, { x: 2, y: 4, type: CellType.Floor }, { x: 3, y: 4, type: CellType.Floor }, { x: 4, y: 4, type: CellType.Floor },
      ],
    };
    gameGrid = new GameGrid(mockMap);
    pathfinder = new Pathfinder(gameGrid);
  });

  it('should find a path between two accessible points', () => {
    const start: Vector2 = { x: 0, y: 0 };
    const end: Vector2 = { x: 2, y: 0 };
    const path = pathfinder.findPath(start, end);
    expect(path).toEqual([{ x: 1, y: 0 }, { x: 2, y: 0 }]);
  });

  it('should return null if start and end are the same', () => {
    const start: Vector2 = { x: 0, y: 0 };
    const end: Vector2 = { x: 0, y: 0 };
    const path = pathfinder.findPath(start, end);
    expect(path).toEqual([]); // Path to self is empty
  });

  it('should return null if no path exists due to walls', () => {
    const start: Vector2 = { x: 0, y: 0 };
    const end: Vector2 = { x: 1, y: 1 }; // Wall
    const path = pathfinder.findPath(start, end);
    expect(path).toBeNull();
  });

  it('should find a path around an obstacle', () => {
    const start: Vector2 = { x: 0, y: 0 };
    const end: Vector2 = { x: 0, y: 2 };
    const path = pathfinder.findPath(start, end);
    // Path should be (0,0) -> (0,1) -> (0,2)
    expect(path).toEqual([{ x: 0, y: 1 }, { x: 0, y: 2 }]);
  });

  it('should find a longer path around multiple obstacles', () => {
    // start (0,0) -> end (4,0)
    // Map has walls at (1,1), (3,1), (1,2), (3,2), (1,3), (3,3)
    const start: Vector2 = { x: 0, y: 0 };
    const end: Vector2 = { x: 4, y: 0 };
    const path = pathfinder.findPath(start, end);
    // Expected path: (0,0) -> (0,1) -> (0,2) -> (0,3) -> (0,4) -> (1,4) -> (2,4) -> (3,4) -> (4,4) -> (4,3) -> (4,2) -> (4,1) -> (4,0) - this is just one possible path
    
    // Verify the path exists and avoids walls
    expect(path).not.toBeNull();
    path?.forEach(p => {
        expect(gameGrid.isWalkable(p.x, p.y)).toBe(true);
    });
    // Check if path ends at target
    expect(path![path!.length - 1]).toEqual(end);
  });
});
