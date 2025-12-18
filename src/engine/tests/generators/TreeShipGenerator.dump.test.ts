import { describe, it } from 'vitest';
import { TreeShipGenerator } from '../../generators/TreeShipGenerator';
import { MapGenerator } from '../../MapGenerator';
import * as fs from 'fs';

describe('TreeShipGenerator Dump', () => {
  it('should dump a 40x40 map', () => {
    const generator = new TreeShipGenerator(123, 40, 40);
    const map = generator.generate();
    const ascii = MapGenerator.toAscii(map);
    fs.writeFileSync('map_40x40.txt', ascii);
  });
});
