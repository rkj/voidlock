import { describe, it, expect } from 'vitest';
import { VisibilityPolygon } from './VisibilityPolygon';
import { MapDefinition, CellType, Vector2 } from '../shared/types';
import { Graph } from '../engine/Graph';

describe('VisibilityPolygon', () => {
    const createMap = (width: number, height: number): MapDefinition => ({
        width,
        height,
        cells: [],
        doors: []
    });

    it('should return a circular polygon for an empty map', () => {
        const map = createMap(10, 10);
        // Add floor cells
        for(let x=0; x<10; x++) {
            for(let y=0; y<10; y++) {
                map.cells.push({ x, y, type: CellType.Floor, walls: { n: false, e: false, s: false, w: false } });
            }
        }
        const graph = new Graph(map);

        const origin = { x: 5.5, y: 5.5 };
        const range = 2;
        const poly = VisibilityPolygon.compute(origin, range, graph);

        expect(poly.length).toBeGreaterThan(0);
        
        // All points should be approx 'range' away
        poly.forEach(p => {
            const d = Math.sqrt((p.x - origin.x)**2 + (p.y - origin.y)**2);
            expect(d).toBeCloseTo(range, 1);
        });
    });

    it('should be blocked by walls', () => {
        const map = createMap(10, 10);
        // Add floor cells
        for(let x=0; x<10; x++) {
            for(let y=0; y<10; y++) {
                // Continuous Wall at x=6 (East of origin)
                // For cell (5, y), the East wall is the boundary to x=6.
                const walls = { n: false, e: (x === 5), s: false, w: false };
                
                map.cells.push({ x, y, type: CellType.Floor, walls });
            }
        }
        const graph = new Graph(map);

        const origin = { x: 5.5, y: 5.5 };
        const range = 3;
        const poly = VisibilityPolygon.compute(origin, range, graph);

        // Expect points to the East to be limited by x=6
        const eastPoints = poly.filter(p => p.x > 6.01);
        expect(eastPoints.length).toBe(0);
    });
});
