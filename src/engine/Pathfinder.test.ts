import { describe, it, expect, beforeEach } from 'vitest';
import { Pathfinder } from './Pathfinder';
import { GameGrid } from './GameGrid';
import { MapDefinition, CellType, Vector2, Door } from '../shared/types';

describe('Pathfinder', () => {
  let mockMap: MapDefinition;
  let gameGrid: GameGrid;
  let pathfinder: Pathfinder;
  const mockDoors: Map<string, Door> = new Map();

  const createTestMapWithDoor = (doorState: 'Open' | 'Closed' | 'Locked' | 'Destroyed'): { map: MapDefinition, doors: Map<string, Door> } => {
    const doorId = 'testDoor';
    const mapCells: Cell[] = [
      { x: 0, y: 0, type: CellType.Floor, walls: { n: true, e: false, s: true, w: true } },
      { x: 1, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: false } },
      { x: 2, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: false } },
    ];

    const door: Door = {
      id: doorId,
      segment: [{ x: 1, y: 0 }], // Door to the right of (1,0), so between (1,0) and (2,0)
      orientation: 'Vertical',
      state: doorState,
      hp: 100,
      maxHp: 100,
      openDuration: 1
    };
    
    const doorsMap = new Map<string, Door>();
    doorsMap.set(doorId, door);

    return {
      map: { width: 3, height: 1, cells: mapCells, doors: [door] },
      doors: doorsMap
    };
  };

  beforeEach(() => {
    // 5x5 map for standard tests. Path from (0,0) to (2,0) goes through (1,0).
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
    pathfinder = new Pathfinder(gameGrid, mockDoors); // Pass mockDoors
  });

  it('should find a path between two accessible points', () => {
    const start: Vector2 = { x: 0, y: 0 };
    const end: Vector2 = { x: 2, y: 0 };
    const path = pathfinder.findPath(start, end);
    expect(path).toEqual([{ x: 1, y: 0 }, { x: 2, y: 0 }]);
  });

  it('should return empty array if start and end are the same', () => {
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

  describe('door pathfinding', () => {
    it('should find a path through an open door', () => {
      const { map, doors } = createTestMapWithDoor('Open');
      const doorGrid = new GameGrid(map);
      const doorPathfinder = new Pathfinder(doorGrid, doors);
      const path = doorPathfinder.findPath({ x: 0, y: 0 }, { x: 2, y: 0 });
      expect(path).toEqual([{ x: 1, y: 0 }, { x: 2, y: 0 }]);
    });

    it('should block pathfinding through a closed door', () => {
      const { map, doors } = createTestMapWithDoor('Closed');
      const doorGrid = new GameGrid(map);
      const doorPathfinder = new Pathfinder(doorGrid, doors);
      const path = doorPathfinder.findPath({ x: 0, y: 0 }, { x: 2, y: 0 });
      expect(path).toBeNull();
    });

    it('should block pathfinding through a locked door', () => {
      const { map, doors } = createTestMapWithDoor('Locked');
      const doorGrid = new GameGrid(map);
      const doorPathfinder = new Pathfinder(doorGrid, doors);
      const path = doorPathfinder.findPath({ x: 0, y: 0 }, { x: 2, y: 0 });
      expect(path).toBeNull();
    });

    it('should find a path through a destroyed door', () => {
      const { map, doors } = createTestMapWithDoor('Destroyed');
      const doorGrid = new GameGrid(map);
      const doorPathfinder = new Pathfinder(doorGrid, doors);
      const path = doorPathfinder.findPath({ x: 0, y: 0 }, { x: 2, y: 0 });
      expect(path).toEqual([{ x: 1, y: 0 }, { x: 2, y: 0 }]);
    });
  });
});