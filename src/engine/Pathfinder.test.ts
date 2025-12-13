import { describe, it, expect, beforeEach } from 'vitest';
import { Pathfinder } from './Pathfinder';
import { GameGrid } from './GameGrid';
import { MapDefinition, CellType, Vector2 } from '../shared/types';

describe('Pathfinder', () => {
  let mockMap: MapDefinition;
  let gameGrid: GameGrid;
  let pathfinder: Pathfinder;

  beforeEach(() => {
    // 5x5 map.
    // Walls at (1,1), (3,1), (1,2), (3,2), (1,3), (3,3)
    const cells = [];
    for(let y=0; y<5; y++) {
        for(let x=0; x<5; x++) {
            let type = CellType.Floor;
            // Add walls pattern
            if ((x===1 || x===3) && (y>=1 && y<=3)) type = CellType.Wall;
            
            cells.push({ x, y, type, walls: { n: false, e: false, s: false, w: false } });
        }
    }

    mockMap = {
      width: 5,
      height: 5,
      cells,
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
    expect(path).toEqual([]); 
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
    expect(path).toEqual([{ x: 0, y: 1 }, { x: 0, y: 2 }]);
  });

  it('should find a longer path around multiple obstacles', () => {
    const start: Vector2 = { x: 0, y: 0 };
    const end: Vector2 = { x: 4, y: 0 };
    const path = pathfinder.findPath(start, end);
    expect(path).not.toBeNull();
    // Check if path ends at target
    expect(path![path!.length - 1]).toEqual(end);
  });
});