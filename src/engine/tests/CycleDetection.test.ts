import { describe, it, expect } from 'vitest';
import { MapDefinition, CellType } from '../../shared/types'; 
import { mapToAdjacencyList, hasCycleDFS } from './utils/GraphUtils';

describe('Cycle Detection Utilities', () => {

  it('should detect no cycles in a simple acyclic graph (line)', () => {
    const map: MapDefinition = {
      width: 3, height: 1,
      cells: [
        { x: 0, y: 0, type: CellType.Floor, walls: { n: true, e: false, s: true, w: true } },
        { x: 1, y: 0, type: CellType.Floor, walls: { n: true, e: false, s: true, w: false } },
        { x: 2, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: false } },
      ],
      doors: [], spawnPoints: [], objectives: [], extraction: undefined
    };
    const adj = mapToAdjacencyList(map);
    expect(hasCycleDFS(adj)).toBe(false);
  });

  it('should detect a simple cycle in a square graph', () => {
    const map: MapDefinition = {
      width: 2, height: 2,
      cells: [
        { x: 0, y: 0, type: CellType.Floor, walls: { n: true, e: false, s: false, w: true } },
        { x: 1, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: false, w: false } },
        { x: 0, y: 1, type: CellType.Floor, walls: { n: false, e: false, s: true, w: true } },
        { x: 1, y: 1, type: CellType.Floor, walls: { n: false, e: true, s: true, w: false } },
      ],
      doors: [], spawnPoints: [], objectives: [], extraction: undefined
    };
    const adj = mapToAdjacencyList(map);
    expect(hasCycleDFS(adj)).toBe(true);
  });

  it('should detect no cycles in a map with disconnected components (acyclic)', () => {
    const map: MapDefinition = {
      width: 4, height: 1,
      cells: [
        { x: 0, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: true } }, // Disconnected 1
        { x: 1, y: 0, type: CellType.Wall, walls: { n: true, e: true, s: true, w: true } },  // Wall
        { x: 2, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: true } }, // Disconnected 2
        { x: 3, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: true } }, // Disconnected 3
      ],
      doors: [], spawnPoints: [], objectives: [], extraction: undefined
    };
    const adj = mapToAdjacencyList(map);
    expect(hasCycleDFS(adj)).toBe(false);
  });
  
  it('should detect a cycle in a more complex graph (figure 8)', () => {
    //   A---B
    //   |   |
    //   D---C---E
    //       |   |
    //       F---G
    const map: MapDefinition = {
        width: 5, height: 3,
        cells: [
            // Row 0
            { x: 0, y: 0, type: CellType.Floor, walls: { n:true, e:false, s:false, w:true } }, // A
            { x: 1, y: 0, type: CellType.Floor, walls: { n:true, e:true, s:false, w:false } },  // B
            { x: 2, y: 0, type: CellType.Wall, walls: { n:true, e:true, s:true, w:true } },
            { x: 3, y: 0, type: CellType.Wall, walls: { n:true, e:true, s:true, w:true } },
            { x: 4, y: 0, type: CellType.Wall, walls: { n:true, e:true, s:true, w:true } },
            // Row 1
            { x: 0, y: 1, type: CellType.Floor, walls: { n:false, e:false, s:true, w:true } }, // D
            { x: 1, y: 1, type: CellType.Floor, walls: { n:false, e:false, s:false, w:false } }, // C
            { x: 2, y: 1, type: CellType.Floor, walls: { n:true, e:true, s:true, w:false } },  // E
            { x: 3, y: 1, type: CellType.Wall, walls: { n:true, e:true, s:true, w:true } },
            { x: 4, y: 1, type: CellType.Wall, walls: { n:true, e:true, s:true, w:true } },
            // Row 2
            { x: 0, y: 2, type: CellType.Wall, walls: { n:true, e:true, s:true, w:true } },
            { x: 1, y: 2, type: CellType.Floor, walls: { n:false, e:false, s:true, w:true } }, // F
            { x: 2, y: 2, type: CellType.Floor, walls: { n:true, e:true, s:true, w:false } },  // G
            { x: 3, y: 2, type: CellType.Wall, walls: { n:true, e:true, s:true, w:true } },
            { x: 4, y: 2, type: CellType.Wall, walls: { n:true, e:true, s:true, w:true } },
        ],
        doors: [], spawnPoints: [], objectives: [], extraction: undefined
    };
    const adj = mapToAdjacencyList(map);
    expect(hasCycleDFS(adj)).toBe(true);
  });

  it('should detect a cycle in a 3x2 grid of floor cells (rectangular cycle)', () => {
    //   (0,0)-(1,0)-(2,0)
    //     |      |    |
    //   (0,1)-(1,1)-(2,1)
    const map: MapDefinition = {
      width: 3, height: 2,
      cells: [
        { x: 0, y: 0, type: CellType.Floor, walls: { n:true, e:false, s:false, w:true } }, // (0,0)
        { x: 1, y: 0, type: CellType.Floor, walls: { n:true, e:false, s:false, w:false } }, // (1,0)
        { x: 2, y: 0, type: CellType.Floor, walls: { n:true, e:true, s:false, w:false } },  // (2,0)

        { x: 0, y: 1, type: CellType.Floor, walls: { n:false, e:false, s:true, w:true } }, // (0,1)
        { x: 1, y: 1, type: CellType.Floor, walls: { n:false, e:false, s:true, w:false } }, // (1,1)
        { x: 2, y: 1, type: CellType.Floor, walls: { n:false, e:true, s:true, w:false } },  // (2,1)
      ],
      doors: [], spawnPoints: [], objectives: [], extraction: undefined
    };

    // Open walls to form a rectangular cycle
    map.cells[0].walls.s = false; map.cells[3].walls.n = false; // (0,0)-(0,1)
    map.cells[1].walls.s = false; map.cells[4].walls.n = false; // (1,0)-(1,1)
    map.cells[2].walls.s = false; map.cells[5].walls.n = false; // (2,0)-(2,1)

    // Open horizontal walls between (0,0)-(1,0), (1,0)-(2,0)
    map.cells[0].walls.e = false; map.cells[1].walls.w = false;
    map.cells[1].walls.e = false; map.cells[2].walls.w = false;

    // Open horizontal walls between (0,1)-(1,1), (1,1)-(2,1)
    map.cells[3].walls.e = false; map.cells[4].walls.w = false;
    map.cells[4].walls.e = false; map.cells[5].walls.w = false;

    const adj = mapToAdjacencyList(map);
    expect(hasCycleDFS(adj)).toBe(true);
  });
});