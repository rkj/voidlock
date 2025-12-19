import { describe, it } from 'vitest';
import { TreeShipGenerator } from '../../generators/TreeShipGenerator';
import { MapGenerator } from '../../MapGenerator';
import * as fs from 'fs';

describe('TreeShipGenerator Dump', () => {
  it('should dump a 16x16 map to ascii file', () => {
    const generator = new TreeShipGenerator(42, 16, 16);
    const map = generator.generate();
    const ascii = MapGenerator.toAscii(map);
    // Write to root
    fs.writeFileSync('map_16x16.txt', ascii);
  });
});
