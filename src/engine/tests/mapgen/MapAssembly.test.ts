import { describe, it, expect } from 'vitest';
import { MapGenerator } from '../../MapGenerator';
import { TileAssembly, TileDefinition, CellType } from '../../../shared/types';
import { SpaceHulkTiles } from '../../../content/tiles';

describe('MapGenerator.assemble', () => {
  it('should assemble a single 1x1 corridor tile', () => {
    const assembly: TileAssembly = {
      tiles: [
        { tileId: 'corridor_1x1', x: 0, y: 0, rotation: 0 }
      ]
    };

    const map = MapGenerator.assemble(assembly, SpaceHulkTiles);

    expect(map.width).toBe(1);
    expect(map.height).toBe(1);
    expect(map.cells[0].type).toBe(CellType.Floor);
    // 1x1 Corridor has Open North/South
    expect(map.cells[0].walls.n).toBe(false);
    expect(map.cells[0].walls.s).toBe(false);
    expect(map.cells[0].walls.e).toBe(true);
    expect(map.cells[0].walls.w).toBe(true);
  });

  it('should assemble and rotate a 1x1 corridor tile', () => {
    const assembly: TileAssembly = {
      tiles: [
        { tileId: 'corridor_1x1', x: 0, y: 0, rotation: 90 }
      ]
    };

    const map = MapGenerator.assemble(assembly, SpaceHulkTiles);

    expect(map.width).toBe(1);
    expect(map.height).toBe(1);
    // Rotated 90: North/South becomes East/West
    expect(map.cells[0].walls.n).toBe(true);
    expect(map.cells[0].walls.s).toBe(true);
    expect(map.cells[0].walls.e).toBe(false);
    expect(map.cells[0].walls.w).toBe(false);
  });

  it('should assemble two connecting tiles', () => {
    // 1x1 Corridor at (0,0) [N/S open]
    // 1x1 Corridor at (0,1) [N/S open]
    const assembly: TileAssembly = {
      tiles: [
        { tileId: 'corridor_1x1', x: 0, y: 0, rotation: 0 },
        { tileId: 'corridor_1x1', x: 0, y: 1, rotation: 0 }
      ]
    };

    const map = MapGenerator.assemble(assembly, SpaceHulkTiles);

    expect(map.width).toBe(1);
    expect(map.height).toBe(2);
    
    // Top cell (0,0)
    expect(map.cells[0].walls.s).toBe(false); // Open to bottom
    // Bottom cell (0,1)
    expect(map.cells[1].walls.n).toBe(false); // Open to top
  });

  it('should assemble a larger room and handle internal walls', () => {
    const assembly: TileAssembly = {
        tiles: [
            { tileId: 'room_3x3', x: 0, y: 0, rotation: 0 }
        ]
    };
    
    const map = MapGenerator.assemble(assembly, SpaceHulkTiles);
    expect(map.width).toBe(3);
    expect(map.height).toBe(3);

    // Center cell (1,1) should have all walls open
    const center = map.cells[4]; // 3*1 + 1
    expect(center.walls.n).toBe(false);
    expect(center.walls.e).toBe(false);
    expect(center.walls.s).toBe(false);
    expect(center.walls.w).toBe(false);
  });

  it('should normalize coordinates (handle negative placement)', () => {
    const assembly: TileAssembly = {
        tiles: [
            { tileId: 'corridor_1x1', x: -5, y: -5, rotation: 0 }
        ]
    };
    const map = MapGenerator.assemble(assembly, SpaceHulkTiles);
    // Should be shifted to 0,0
    expect(map.width).toBe(1);
    expect(map.height).toBe(1);
    expect(map.cells[0].x).toBe(0);
    expect(map.cells[0].y).toBe(0);
  });

  it('should assemble a valid playable map', () => {
    // 3x1 corridor: Spawn -> Empty -> Objective/Extraction
    // We need a tile that has no open edges to the outside to pass validation
    const closedCorridor: TileDefinition = {
        id: 'closed_corridor_1x3',
        width: 1,
        height: 3,
        cells: [
            { x: 0, y: 0, openEdges: ['s'] },
            { x: 0, y: 1, openEdges: ['n', 's'] },
            { x: 0, y: 2, openEdges: ['n'] }
        ]
    };
    const library = { ...SpaceHulkTiles, [closedCorridor.id]: closedCorridor };

    const assembly: TileAssembly = {
        tiles: [
            { tileId: 'closed_corridor_1x3', x: 0, y: 0, rotation: 0 }
        ],
        globalSpawnPoints: [{ id: 'sp1', cell: { x: 0, y: 0 } }],
        globalExtraction: { cell: { x: 0, y: 2 } },
        globalObjectives: [{ id: 'obj1', kind: 'Recover', cell: { x: 0, y: 2 } }]
    };

    const map = MapGenerator.assemble(assembly, library);
    const generator = new MapGenerator(123);
    const result = generator.validate(map);

    expect(result.isValid, `Validation Issues: ${result.issues.join(', ')}`).toBe(true);
  });
});
