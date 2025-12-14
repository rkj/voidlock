import { describe, it, expect } from 'vitest';
import { MapGenerator } from './MapGenerator';
import { CellType, MapDefinition, IMapValidationResult, Door, Vector2 } from '../shared/types';

describe('MapGenerator', () => {
  it('should generate a map with cells and walls', () => {
    const generator = new MapGenerator(123);
    const map = generator.generate(16, 16);

    expect(map.width).toBe(16);
    expect(map.height).toBe(16);
    expect(map.cells.length).toBe(256);
    
    // All should be floor
    const floors = map.cells.filter(c => c.type === CellType.Floor);
    expect(floors.length).toBe(256);
    
    // Check extraction
    expect(map.extraction).toBeDefined();
    
    // Check some walls are removed (it's a maze)
    // A grid of 16x16 with all walls = 256 cells * 4 walls = 1024 walls (double counted)
    // A maze should have opened paths.
    // Check if any cell has a false wall
    const openWalls = map.cells.some(c => !c.walls.n || !c.walls.e || !c.walls.s || !c.walls.w);
    expect(openWalls).toBe(true);
  });

  it('should be deterministic with same seed', () => {
    const gen1 = new MapGenerator(555);
    const map1 = gen1.generate(10, 10);

    const gen2 = new MapGenerator(555);
    const map2 = gen2.generate(10, 10);

    expect(map1).toEqual(map2);
  });
});

describe('MapGenerator.validate', () => {
  const createBaseMap = (): MapDefinition => ({
    width: 2,
    height: 2,
    cells: [
      { x: 0, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: true } },
      { x: 1, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: true } },
      { x: 0, y: 1, type: CellType.Floor, walls: { n: true, e: true, s: true, w: true } },
      { x: 1, y: 1, type: CellType.Floor, walls: { n: true, e: true, s: true, w: true } },
    ],
    spawnPoints: [{ id: 'sp1', pos: { x: 0, y: 0 }, radius: 1 }],
    extraction: { x: 1, y: 1 },
    objectives: [{ id: 'obj1', kind: 'Recover', targetCell: { x: 0, y: 1 } }],
  });

  it('should validate a simple valid map', () => {
    const generator = new MapGenerator(1);
    const map = createBaseMap();
    // Connect 0,0 to 1,0
    map.cells[0].walls.e = false;
    map.cells[1].walls.w = false;
    // Connect 1,0 to 1,1
    map.cells[1].walls.s = false;
    map.cells[3].walls.n = false;
    // Connect 0,1 to 1,1
    map.cells[2].walls.e = false;
    map.cells[3].walls.w = false;

    const result = generator.validate(map);
    expect(result.isValid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('should invalidate map with non-positive dimensions', () => {
    const generator = new MapGenerator(1);
    const map = createBaseMap();
    map.width = 0;
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain('Map dimensions (width and height) must be positive.');
  });

  it('should invalidate map with incorrect number of cells', () => {
    const generator = new MapGenerator(1);
    const map = createBaseMap();
    map.cells.pop(); // Remove one cell
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain('Number of cells (3) does not match map dimensions (2x2 = 4).');
  });

  it('should invalidate map with cells out of bounds', () => {
    const generator = new MapGenerator(1);
    const map = createBaseMap();
    map.cells[0] = { x: -1, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: true } };
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain('Cell at (-1, 0) is out of map bounds.');
  });

  it('should invalidate map with duplicate cells', () => {
    const generator = new MapGenerator(1);
    const map = createBaseMap();
    map.cells[1] = { x: 0, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: true } }; // Duplicate 0,0
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain('Duplicate cell definition at (0, 0).');
  });

  it('should invalidate map with doors out of bounds', () => {
    const generator = new MapGenerator(1);
    const map = createBaseMap();
    map.doors = [{ id: 'd1', segment: [{ x: 5, y: 0 }, { x: 5, y: 1 }], orientation: 'Vertical', state: 'Closed', hp: 10, maxHp: 10, openDuration: 1 }];
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain('Door d1 segment at (5, 0) is out of map bounds.');
  });

  it('should invalidate map with door not adjacent to floor cells', () => {
    const generator = new MapGenerator(1);
    const map = createBaseMap();
    map.cells[0].type = CellType.Wall; // Make 0,0 a wall
    map.doors = [{ id: 'd1', segment: [{ x: 0, y: 0 }, { x: 1, y: 0 }], orientation: 'Horizontal', state: 'Closed', hp: 10, maxHp: 10, openDuration: 1 }];
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain('Door d1 segment at (0, 0) is not adjacent to a Floor cell.');
  });

  it('should invalidate map with non-adjacent door segments', () => {
    const generator = new MapGenerator(1);
    const map = createBaseMap();
    map.doors = [{ id: 'd1', segment: [{ x: 0, y: 0 }, { x: 1, y: 1 }], orientation: 'Vertical', state: 'Closed', hp: 10, maxHp: 10, openDuration: 1 }];
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain('Door d1 segments at (0,0) and (1,1) are not adjacent.');
  });

  it('should invalidate map with spawn point out of bounds', () => {
    const generator = new MapGenerator(1);
    const map = createBaseMap();
    map.spawnPoints = [{ id: 'sp1', pos: { x: 5, y: 0 }, radius: 1 }];
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain('Spawn point sp1 at (5, 0) is out of map bounds.');
  });

  it('should invalidate map with spawn point not on a floor cell', () => {
    const generator = new MapGenerator(1);
    const map = createBaseMap();
    map.cells[0].type = CellType.Wall; // Make 0,0 a wall
    map.spawnPoints = [{ id: 'sp1', pos: { x: 0, y: 0 }, radius: 1 }];
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain('Spawn point sp1 at (0, 0) is not on a Floor cell.');
  });

  it('should invalidate map with extraction point out of bounds', () => {
    const generator = new MapGenerator(1);
    const map = createBaseMap();
    map.extraction = { x: 5, y: 5 };
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain('Extraction point at (5, 5) is out of map bounds.');
  });

  it('should invalidate map with extraction point not on a floor cell', () => {
    const generator = new MapGenerator(1);
    const map = createBaseMap();
    map.cells[3].type = CellType.Wall; // Make 1,1 a wall
    map.extraction = { x: 1, y: 1 };
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain('Extraction point at (1, 1) is not on a Floor cell.');
  });

  it('should invalidate map with objective target cell out of bounds', () => {
    const generator = new MapGenerator(1);
    const map = createBaseMap();
    map.objectives = [{ id: 'obj1', kind: 'Recover', targetCell: { x: 5, y: 5 } }];
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain('Objective obj1 target cell at (5, 5) is out of map bounds.');
  });

  it('should invalidate map with objective target cell not on a floor cell', () => {
    const generator = new MapGenerator(1);
    const map = createBaseMap();
    map.cells[2].type = CellType.Wall; // Make 0,1 a wall
    map.objectives = [{ id: 'obj1', kind: 'Recover', targetCell: { x: 0, y: 1 } }];
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain('Objective obj1 target cell at (0, 1) is not on a Floor cell.');
  });

  it('should invalidate map with unreachable floor cells', () => {
    const generator = new MapGenerator(1);
    const map = createBaseMap();
    // Make (0,0) only connected to (1,0), but (0,1) and (1,1) are isolated
    map.cells[0].walls.e = false; // 0,0 - 1,0
    map.cells[1].walls.w = false;

    // Isolate 0,1 and 1,1 from the rest
    map.cells[0].walls.s = true;
    map.cells[2].walls.n = true;
    map.cells[1].walls.s = true;
    map.cells[3].walls.n = true;
    
    // (0,0) is spawn, (1,1) is extraction, (0,1) is objective
    // (0,1) and (1,1) should be unreachable from (0,0)
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain('Floor cell at (0, 1) is not reachable from any spawn point.');
    expect(result.issues).toContain('Floor cell at (1, 1) is not reachable from any spawn point.');
  });

  it('should invalidate map with unreachable extraction point', () => {
    const generator = new MapGenerator(1);
    const map = createBaseMap();
    // Connect 0,0 to 1,0
    map.cells[0].walls.e = false;
    map.cells[1].walls.w = false;
    // Make extraction at 1,1 unreachable from 0,0
    map.cells[1].walls.s = true;
    map.cells[3].walls.n = true;

    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain('Extraction point at (1, 1) is not reachable from any spawn point.');
  });

  it('should invalidate map with unreachable objective', () => {
    const generator = new MapGenerator(1);
    const map = createBaseMap();
    // Connect 0,0 to 1,0
    map.cells[0].walls.e = false;
    map.cells[1].walls.w = false;
    // Connect 1,0 to 1,1
    map.cells[1].walls.s = false;
    map.cells[3].walls.n = false;
    // Make objective at 0,1 unreachable
    map.cells[2].walls.e = true;
    map.cells[3].walls.w = true;

    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain('Objective obj1 target cell at (0, 1) is not reachable from any spawn point.');
  });
});