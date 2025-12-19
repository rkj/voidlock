import { describe, it, expect } from 'vitest';
import { TreeShipGenerator } from '../../generators/TreeShipGenerator';
import { MapGenerator } from '../../MapGenerator';
import { MapDefinition, CellType } from '../../../shared/types';
import { mapToAdjacencyList, hasCycleDFS, calculateFillRate } from '../utils/GraphUtils';

describe('TreeShipGenerator 12x12', () => {
  it('should generate a 12x12 map (Seed 42) with sparse fill', async () => {
    const generator = new TreeShipGenerator(42, 12, 12);
    const map = generator.generate();
    
    const ascii = MapGenerator.toAscii(map);
    
    // Use golden file snapshot
    await expect(ascii).toMatchFileSnapshot('./snapshots/TreeShipGenerator.12x12.txt');

    // Verify properties
    expect(map.width).toBe(12);
    expect(map.height).toBe(12);
    
    // Verify acyclicity
    // const adj = mapToAdjacencyList(map);
    // expect(hasCycleDFS(adj)).toBe(false); // Cycles allowed for rooms now

    // Verify fill rate (relaxed for claustrophobic design)
    expect(calculateFillRate(map)).toBeGreaterThanOrEqual(0.2);
  });
});
