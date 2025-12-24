import { describe, it, expect } from 'vitest';
import { Graph, Boundary, GraphCell } from './Graph';
import { CellType } from '../shared/types';

describe('Graph', () => {
  it('should initialize with correct dimensions', () => {
    const graph = new Graph(10, 5);
    expect(graph.width).toBe(10);
    expect(graph.height).toBe(5);
    expect(graph.cells.length).toBe(5);
    expect(graph.cells[0].length).toBe(10);
  });

  it('should create GraphCell with correct coordinates', () => {
    const graph = new Graph(2, 2);
    expect(graph.cells[0][0].x).toBe(0);
    expect(graph.cells[0][0].y).toBe(0);
    expect(graph.cells[1][1].x).toBe(1);
    expect(graph.cells[1][1].y).toBe(1);
    expect(graph.cells[1][1].type).toBe(CellType.Wall);
  });

  it('should generate consistent boundary keys regardless of order', () => {
    const graph = new Graph(2, 2);
    const key1 = graph.getBoundaryKey(0, 0, 1, 0);
    const key2 = graph.getBoundaryKey(1, 0, 0, 0);
    expect(key1).toBe(key2);
    expect(key1).toBe('0,0--1,0');
  });
});
