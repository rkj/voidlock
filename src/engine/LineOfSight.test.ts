import { describe, it, expect, beforeEach } from 'vitest';
import { LineOfSight } from './LineOfSight';
import { GameGrid } from './GameGrid';
import { MapDefinition, CellType, Door, Vector2, Cell } from '../shared/types';

describe('LineOfSight', () => {
  let mockMap: MapDefinition;
  let gameGrid: GameGrid;
  let los: LineOfSight;
  const mockDoors: Map<string, Door> = new Map();

  const createTestMapWithDoor = (doorState: 'Open' | 'Closed' | 'Locked' | 'Destroyed'): { map: MapDefinition, doors: Map<string, Door> } => {
    const doorId = 'testDoor';
    const mapCells: Cell[] = [
      // Cell (0,0) -> Door -> Cell (1,0) -> Cell (2,0)
      { x: 0, y: 0, type: CellType.Floor, walls: { n: true, e: false, s: true, w: true } },
      { x: 1, y: 0, type: CellType.Floor, walls: { n: true, e: false, s: true, w: false } }, // Door is between (0,0) and (1,0)
      { x: 2, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: false } },
    ];

    const door: Door = {
      id: doorId,
      segment: [{ x: 0, y: 0 }], // Door to the right of (0,0), so between (0,0) and (1,0)
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
    // 5x5 map with a wall in center (2,2)
    // To replicate old behavior: (2,2) is Wall type (Void).
    // All others Floor.
    // Walls between cells: all open (false) except boundaries.
    
    const cells = [];
    for(let y=0; y<5; y++) {
        for(let x=0; x<5; x++) {
            let type = CellType.Floor;
            if (x === 2 && y === 2) type = CellType.Wall;
            cells.push({ x, y, type, walls: { n: false, e: false, s: false, w: false } });
        }
    }

    mockMap = {
      width: 5,
      height: 5,
      cells,
    };
    gameGrid = new GameGrid(mockMap);
    los = new LineOfSight(gameGrid, mockDoors);
  });

  it('should see adjacent cells', () => {
    const origin = { x: 0.5, y: 0.5 };
    const visible = los.computeVisibleCells(origin, 1.5);
    expect(visible).toContain('0,0');
    expect(visible).toContain('1,0');
    expect(visible).toContain('0,1');
    expect(visible).toContain('1,1'); 
  });

  it('should be blocked by walls', () => {
    const origin = { x: 0.5, y: 2.5 };
    const visible = los.computeVisibleCells(origin, 5);
    
    expect(visible).toContain('0,2'); 
    expect(visible).toContain('1,2'); 
    
    expect(visible).not.toContain('3,2'); 
    expect(visible).not.toContain('4,2');
  });

  it('should see around corners', () => {
    const origin = { x: 1.5, y: 1.5 };
    const visible = los.computeVisibleCells(origin, 5);
    
    // (2,2) is void.
    expect(visible).not.toContain('3,3'); 
  });

  describe('door line of sight', () => {
    it('should have LOS through an open door', () => {
      const { map, doors } = createTestMapWithDoor('Open');
      const doorGrid = new GameGrid(map);
      const doorLos = new LineOfSight(doorGrid, doors);
      expect(doorLos.hasLineOfSight({ x: 0.5, y: 0.5 }, { x: 1.5, y: 0.5 })).toBe(true);
      expect(doorLos.hasLineOfSight({ x: 0.5, y: 0.5 }, { x: 2.5, y: 0.5 })).toBe(true);
    });

    it('should block LOS through a closed door', () => {
      const { map, doors } = createTestMapWithDoor('Closed');
      const doorGrid = new GameGrid(map);
      const doorLos = new LineOfSight(doorGrid, doors);
      // LOS from (0,0) to (1,0) should be blocked by a closed door between them
      expect(doorLos.hasLineOfSight({ x: 0.5, y: 0.5 }, { x: 1.5, y: 0.5 })).toBe(false); 
      expect(doorLos.hasLineOfSight({ x: 0.5, y: 0.5 }, { x: 2.5, y: 0.5 })).toBe(false); 
    });

    it('should block LOS through a locked door', () => {
      const { map, doors } = createTestMapWithDoor('Locked');
      const doorGrid = new GameGrid(map);
      const doorLos = new LineOfSight(doorGrid, doors);
      // LOS from (0,0) to (1,0) should be blocked by a locked door between them
      expect(doorLos.hasLineOfSight({ x: 0.5, y: 0.5 }, { x: 1.5, y: 0.5 })).toBe(false); 
      expect(doorLos.hasLineOfSight({ x: 0.5, y: 0.5 }, { x: 2.5, y: 0.5 })).toBe(false); 
    });

    it('should have LOS through a destroyed door', () => {
      const { map, doors } = createTestMapWithDoor('Destroyed');
      const doorGrid = new GameGrid(map);
      const doorLos = new LineOfSight(doorGrid, doors);
      expect(doorLos.hasLineOfSight({ x: 0.5, y: 0.5 }, { x: 1.5, y: 0.5 })).toBe(true);
      expect(doorLos.hasLineOfSight({ x: 0.5, y: 0.5 }, { x: 2.5, y: 0.5 })).toBe(true);
    });
  });

  describe('thin wall line of sight', () => {
    it('should block LOS through a thin wall between cells', () => {
      const map: MapDefinition = {
        width: 2, height: 1,
        cells: [
          { x: 0, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: true } }, // East wall closed
          { x: 1, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: true } }  // West wall closed
        ]
      };
      const grid = new GameGrid(map);
      const los = new LineOfSight(grid, mockDoors);
      
      // Center to Center
      expect(los.hasLineOfSight({ x: 0.5, y: 0.5 }, { x: 1.5, y: 0.5 })).toBe(false);

      // Close proximity (0.9 to 1.1)
      expect(los.hasLineOfSight({ x: 0.9, y: 0.5 }, { x: 1.1, y: 0.5 })).toBe(false);
    });
  });

  it('should block LOS from all angles into an enclosed cell', () => {
    // 3x3 map. Center (1,1) is Floor but surrounded by walls.
    // (1,1).walls = { n: true, e: true, s: true, w: true }
    // Neighbors have corresponding walls.
    const cells: Cell[] = [];
    for(let y=0; y<3; y++) {
        for(let x=0; x<3; x++) {
            const c: Cell = { x, y, type: CellType.Floor, walls: { n: false, e: false, s: false, w: false } };
            if (x===1 && y===1) {
                c.walls = { n: true, e: true, s: true, w: true };
            }
            // Update neighbors of center
            if (x===1 && y===0) c.walls.s = true;
            if (x===1 && y===2) c.walls.n = true;
            if (x===0 && y===1) c.walls.e = true;
            if (x===2 && y===1) c.walls.w = true;
            
            cells.push(c);
        }
    }
    const map: MapDefinition = { width: 3, height: 3, cells };
    const grid = new GameGrid(map);
    const los = new LineOfSight(grid, mockDoors);

    const center = { x: 1.5, y: 1.5 };
    const radius = 1.2; // Circle around center, in adjacent cells

    for (let angle = 0; angle < 360; angle += 10) {
        const rad = angle * Math.PI / 180;
        const start = {
            x: center.x + Math.cos(rad) * radius,
            y: center.y + Math.sin(rad) * radius
        };
        // Expect NO line of sight from outside to inside
        const hasLos = los.hasLineOfSight(start, center);
        if (hasLos) {
            console.log(`Leaked LOS at angle ${angle}: start(${start.x.toFixed(2)}, ${start.y.toFixed(2)}) -> center(${center.x}, ${center.y})`);
        }
        expect(hasLos).toBe(false);
    }
  });
});