import { describe, it, expect, beforeEach } from 'vitest';
import { Pathfinder } from './Pathfinder';
import { GameGrid } from './GameGrid';
import { MapDefinition, CellType, Vector2, Door, Cell } from '../shared/types';

describe('Pathfinder', () => {
  let mockMap: MapDefinition;
  let gameGrid: GameGrid;
  let pathfinder: Pathfinder;
  const mockDoors: Map<string, Door> = new Map();

  const createTestMapWithDoor = (doorState: 'Open' | 'Closed' | 'Locked' | 'Destroyed'): { map: MapDefinition, doors: Map<string, Door> } => {
    const doorId = 'testDoor';
    const mapCells: Cell[] = [
      { x: 0, y: 0, type: CellType.Floor },
      { x: 1, y: 0, type: CellType.Floor },
      { x: 2, y: 0, type: CellType.Floor },
    ];

    const door: Door = {
      id: doorId,
      segment: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
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
    const cells = [];
    for(let y=0; y<5; y++) {
        for(let x=0; x<5; x++) {
            let type = CellType.Floor;
            if ((x===1 || x===3) && (y>=1 && y<=3)) type = CellType.Wall;
            cells.push({ x, y, type });
        }
    }

    mockMap = {
      width: 5,
      height: 5,
      cells,
    };
    gameGrid = new GameGrid(mockMap);
    pathfinder = new Pathfinder(gameGrid.getGraph(), mockDoors); 
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
      expect(path![path!.length - 1]).toEqual(end);
  });
  
  it('should return null if no path exists to an unreachable floor cell', () => {
      const cells: Cell[] = [
          { x: 0, y: 0, type: CellType.Floor },
          { x: 1, y: 0, type: CellType.Floor }
      ];
      const map: MapDefinition = {
          width: 2, height: 1, cells,
          walls: [{ p1: {x: 0, y: 0}, p2: {x: 1, y: 0} }]
      };
      const tg = new GameGrid(map);
      const tp = new Pathfinder(tg.getGraph(), new Map());
      expect(tp.findPath({x: 0, y: 0}, {x: 1, y: 0})).toBeNull();
  });

  describe('door pathfinding', () => {
    it('should find a path through an open door', () => {
      const { map, doors } = createTestMapWithDoor('Open');
      const doorGrid = new GameGrid(map);
      const doorPathfinder = new Pathfinder(doorGrid.getGraph(), doors);
      const path = doorPathfinder.findPath({ x: 0, y: 0 }, { x: 2, y: 0 });
      expect(path).not.toBeNull();
      expect(path).toContainEqual({ x: 1, y: 0 });
    });

    it('should NOT find a path through a closed door by default', () => {
      const { map, doors } = createTestMapWithDoor('Closed');
      const doorGrid = new GameGrid(map);
      const doorPathfinder = new Pathfinder(doorGrid.getGraph(), doors);
      const path = doorPathfinder.findPath({ x: 0, y: 0 }, { x: 2, y: 0 });
      expect(path).toBeNull();
    });

    it('should find a path through a closed door if allowClosedDoors is true', () => {
      const { map, doors } = createTestMapWithDoor('Closed');
      const doorGrid = new GameGrid(map);
      const doorPathfinder = new Pathfinder(doorGrid.getGraph(), doors);
      const path = doorPathfinder.findPath({ x: 0, y: 0 }, { x: 2, y: 0 }, true);
      expect(path).not.toBeNull();
    });

    it('should NOT find a path through a locked door even if allowClosedDoors is true', () => {
      const { map, doors } = createTestMapWithDoor('Locked');
      const doorGrid = new GameGrid(map);
      const doorPathfinder = new Pathfinder(doorGrid.getGraph(), doors);
      const path = doorPathfinder.findPath({ x: 0, y: 0 }, { x: 2, y: 0 }, true);
      expect(path).toBeNull();
    });
  });
});
