import { describe, it, expect, beforeEach } from 'vitest';
import { GameGrid } from './GameGrid';
import { MapDefinition, CellType, Cell, Door } from '../shared/types';

describe('GameGrid', () => {
  let mockMap: MapDefinition;
  let grid: GameGrid;

  const createTestMapWithDoor = (doorState: 'Open' | 'Closed' | 'Locked' | 'Destroyed'): { map: MapDefinition, doors: Map<string, Door> } => {
    const doorId = 'testDoor';
    const mapCells: Cell[] = [
      // Cell (0,0) -> Door -> Cell (1,0)
      { x: 0, y: 0, type: CellType.Floor, walls: { n: true, e: false, s: true, w: true } },
      { x: 1, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: false } },
    ];

    const door: Door = {
      id: doorId,
      segment: [{ x: 0, y: 0 }, { x: 1, y: 0 }], // Door between (0,0) and (1,0)
      orientation: 'Vertical',
      state: doorState,
      hp: 100,
      maxHp: 100,
      openDuration: 1
    };
    
    const doorsMap = new Map<string, Door>();
    doorsMap.set(doorId, door);

    return {
      map: { width: 2, height: 1, cells: mapCells, doors: [door] },
      doors: doorsMap
    };
  };

  beforeEach(() => {
    // 2x2 map for standard tests
    const cells: Cell[] = [
      { x: 0, y: 0, type: CellType.Floor, walls: { n: true, e: false, s: true, w: true } },
      { x: 1, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: false } }, 
      
      { x: 0, y: 1, type: CellType.Floor, walls: { n: true, e: true, s: true, w: true } }, 
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
    expect(grid.canMove(0, 0, 1, 0, new Map())).toBe(true);
    expect(grid.canMove(1, 0, 0, 0, new Map())).toBe(true);
  });

  it('should block movement through walls', () => {
    expect(grid.canMove(0, 0, 0, 1, new Map())).toBe(false);
  });

  it('should block movement to void/wall cells', () => {
    expect(grid.canMove(1, 0, 1, 1, new Map())).toBe(false);
  });

  describe('door movement', () => {
    it('should allow movement through an open door', () => {
      const { map, doors } = createTestMapWithDoor('Open');
      const doorGrid = new GameGrid(map);
      expect(doorGrid.canMove(0, 0, 1, 0, doors)).toBe(true);
      expect(doorGrid.canMove(1, 0, 0, 0, doors)).toBe(true);
    });

    it('should block movement through a closed door', () => {
      const { map, doors } = createTestMapWithDoor('Closed');
      const doorGrid = new GameGrid(map);
      expect(doorGrid.canMove(0, 0, 1, 0, doors)).toBe(false);
      expect(doorGrid.canMove(1, 0, 0, 0, doors)).toBe(false);
    });

    it('should block movement through a locked door', () => {
      const { map, doors } = createTestMapWithDoor('Locked');
      const doorGrid = new GameGrid(map);
      expect(doorGrid.canMove(0, 0, 1, 0, doors)).toBe(false);
      expect(doorGrid.canMove(1, 0, 0, 0, doors)).toBe(false);
    });

    it('should allow movement through a destroyed door', () => {
      const { map, doors } = createTestMapWithDoor('Destroyed');
      const doorGrid = new GameGrid(map);
      expect(doorGrid.canMove(0, 0, 1, 0, doors)).toBe(true);
      expect(doorGrid.canMove(1, 0, 0, 0, doors)).toBe(true);
    });
  });

  describe('robustness', () => {
    it('should block movement if EITHER side of the edge has a wall (asymmetric map data)', () => {
        const cells: Cell[] = [
            { x: 0, y: 0, type: CellType.Floor, walls: { n: false, e: false, s: false, w: false } }, // East wall OPEN
            { x: 1, y: 0, type: CellType.Floor, walls: { n: false, e: false, s: false, w: true } }   // West wall CLOSED
        ];
        const asymMap: MapDefinition = { width: 2, height: 1, cells };
        const asymGrid = new GameGrid(asymMap);

        // Moving East: (0,0) -> (1,0). (0,0).e is Open. But (1,0).w is Closed. Should be BLOCKED.
        expect(asymGrid.canMove(0, 0, 1, 0, new Map())).toBe(false);

        // Moving West: (1,0) -> (0,0). (1,0).w is Closed. Should be BLOCKED.
        expect(asymGrid.canMove(1, 0, 0, 0, new Map())).toBe(false);
    });
  });
});