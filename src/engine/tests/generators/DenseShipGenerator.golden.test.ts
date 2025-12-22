import { describe, it } from 'vitest';
import { DenseShipGenerator } from '../../generators/DenseShipGenerator';
import { MapGenerator } from '../../MapGenerator';
import * as fs from 'fs';
import * as path from 'path';

describe('DenseShipGenerator Golden', () => {
  it('should generate a golden snapshot for Seed 1766364915449', () => {
    const generator = new DenseShipGenerator(1766364915449, 12, 12);
    const map = generator.generate();
    const ascii = MapGenerator.toAscii(map);
    const debug = generator.toDetailedDebugString();
    
    const snapshotPath = path.join(__dirname, 'snapshots', 'DenseShipGenerator.12x12.golden.txt');
    fs.writeFileSync(snapshotPath, ascii);

    const debugPath = path.join(__dirname, 'snapshots', 'DenseShipGenerator.12x12.debug.txt');
    fs.writeFileSync(debugPath, debug);
    
    console.log(`\n--- SNAPSHOT START ---\n${ascii}\n--- SNAPSHOT END ---`);
    console.log(`\n--- DEBUG MAP START ---\n${debug}\n--- DEBUG MAP END ---`);
  });
});
