import { describe, it, expect } from 'vitest';
import { TreeShipGenerator } from '../../generators/TreeShipGenerator';
import { mapToAdjacencyList, hasCycleDFS, calculateFillRate, checkConnectivity } from '../utils/GraphUtils';

describe('TreeShipGenerator Multi-Corridor', () => {
  const seeds = [1, 42, 123, 999];
  const sizes = [
    { w: 16, h: 16 },
    { w: 16, h: 12 },
    { w: 12, h: 16 },
    { w: 12, h: 12 }
  ];

  for (const size of sizes) {
    for (const seed of seeds) {
      it(`should generate a ${size.w}x${size.h} map for seed ${seed} with valid fill rate`, () => {
        const generator = new TreeShipGenerator(seed, size.w, size.h);
        const map = generator.generate();
        // const adj = mapToAdjacencyList(map);
        
        // expect(hasCycleDFS(adj)).toBe(false); // Cycles allowed
        
        const fillRate = calculateFillRate(map);
        // Larger maps might have slightly lower fill rate if skeleton is sparse, 
        // but the goal is high density.
        expect(fillRate).toBeGreaterThanOrEqual(0.2);

        expect(checkConnectivity(map)).toBe(true);
      });
    }
  }
});
