import { describe, it, expect } from 'vitest';
import { Graph, Boundary, GraphCell } from './Graph';
import { CellType, MapDefinition } from '../shared/types';

describe('Graph', () => {
  const mockMap: MapDefinition = {
    width: 2,
    height: 1,
    cells: [
      { x: 0, y: 0, type: CellType.Floor },
      { x: 1, y: 0, type: CellType.Floor }
    ],
    walls: [
        { p1: {x: 0, y: 0}, p2: {x: 1, y: 0} }
    ]
  };

  it('should initialize with correct dimensions from MapDefinition', () => {
    const graph = new Graph(mockMap);
    expect(graph.width).toBe(2);
    expect(graph.height).toBe(1);
  });

  it('should set cell types and roomIds', () => {
    const mapWithRoom: MapDefinition = {
      ...mockMap,
      cells: [
        { x: 0, y: 0, type: CellType.Floor, roomId: 'room1' },
        { x: 1, y: 0, type: CellType.Floor }
      ]
    };
    const graph = new Graph(mapWithRoom);
    expect(graph.cells[0][0].type).toBe(CellType.Floor);
    expect(graph.cells[0][0].roomId).toBe('room1');
  });

  it('should share Boundary objects between adjacent cells', () => {
    const graph = new Graph(mockMap);
    const cell0 = graph.cells[0][0];
    const cell1 = graph.cells[0][1];

    expect(cell0.edges.e).toBeDefined();
    expect(cell1.edges.w).toBeDefined();
    expect(cell0.edges.e).toBe(cell1.edges.w); // Reference equality
    expect(cell0.edges.e?.isWall).toBe(true);
  });

  it('should handle doors correctly', () => {
    const mapWithDoor: MapDefinition = {
      width: 2, height: 1,
      cells: [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 1, y: 0, type: CellType.Floor }
      ],
      doors: [
        {
          id: 'door1',
          segment: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
          orientation: 'Vertical',
          state: 'Closed',
          hp: 100, maxHp: 100, openDuration: 5
        }
      ]
    };
    const graph = new Graph(mapWithDoor);
    const boundary = graph.cells[0][0].edges.e;
    expect(boundary?.doorId).toBe('door1');
    expect(boundary?.isWall).toBe(true);
  });

  it('should create separate boundaries for non-shared edges (map boundaries)', () => {
    const graph = new Graph(mockMap);
    const cell0 = graph.cells[0][0];
    const cell1 = graph.cells[0][1];

    expect(cell0.edges.w).toBeDefined();
    expect(cell1.edges.e).toBeDefined();
    expect(cell0.edges.w).not.toBe(cell1.edges.e);
  });
});
