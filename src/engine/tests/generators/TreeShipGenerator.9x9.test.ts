import { describe, it, expect } from 'vitest';
import { TreeShipGenerator } from '../../generators/TreeShipGenerator';
import { MapGenerator } from '../../MapGenerator';
import { MapDefinition, CellType } from '../../../shared/types';
import { mapToAdjacencyList, hasCycleDFS, calculateFillRate } from '../utils/GraphUtils';

describe('TreeShipGenerator 9x9', () => {
  it('should generate a 9x9 map (Seed 42) with >90% fill rate', () => {
    const generator = new TreeShipGenerator(42, 9, 9);
    const map = generator.generate();
    
    const ascii = MapGenerator.toAscii(map);
    // console.log(ascii);

    const expectedAscii = `+-+-+-+-+-+-+-+-+-+
|S  | |   |   | |E|
+-+-+-+   +   + +-+
| |   | | | | | |O|
+ + +-+-+-+-+-+-+-+ +
| |   | |   |   | |
+-+   + +   +   +-+
| | | | | | | | | |
+ + +-+-+ +-+-+-+-+ +
| |             | |
+-+-+-+ +-+-+-+-+-+
| |   | |   |   | |
+ +   + +   +   +-+
| | | | | | | | | |
+-+-+-+-+-+-+-+-+ +
| |   | |   |   | |
+ +   + +   +   +-+
| | | | | | | | | |
+-+-+-+-+-+-+-+-+-+`;

    expect(ascii).toBe(expectedAscii);

    // Verify properties
    expect(map.width).toBe(9);
    expect(map.height).toBe(9);
    
    // Verify acyclicity
    const adj = mapToAdjacencyList(map);
    expect(hasCycleDFS(adj)).toBe(false);

    // Verify fill rate
    expect(calculateFillRate(map)).toBeGreaterThanOrEqual(0.9);
  });
});
