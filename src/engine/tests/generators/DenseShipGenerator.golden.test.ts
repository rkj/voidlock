import { describe, it, expect } from 'vitest';
import { DenseShipGenerator } from '../../generators/DenseShipGenerator';
import { MapGenerator } from '../../MapGenerator';
import * as fs from 'fs';
import * as path from 'path';

describe('DenseShipGenerator Golden', () => {
  const seed = 1766364915449;
  const width = 12;
  const height = 12;

  it('should match the golden snapshot for Seed 1766364915449', () => {
    const generator = new DenseShipGenerator(seed, width, height);
    const map = generator.generate();
    const ascii = MapGenerator.toAscii(map);
    const debug = generator.toDetailedDebugString();
    
    const snapshotPath = path.join(__dirname, 'snapshots', 'DenseShipGenerator.12x12.golden.txt');
    const debugPath = path.join(__dirname, 'snapshots', 'DenseShipGenerator.12x12.debug.txt');

    if (!fs.existsSync(snapshotPath) || !fs.existsSync(debugPath)) {
        // If files don't exist, create them (first run)
        fs.writeFileSync(snapshotPath, ascii);
        fs.writeFileSync(debugPath, debug);
        console.log('Golden snapshots created.');
        return;
    }

    const expectedAscii = fs.readFileSync(snapshotPath, 'utf8');
    const expectedDebug = fs.readFileSync(debugPath, 'utf8');

    expect(ascii, 'ASCII Map mismatch').toBe(expectedAscii);
    expect(debug, 'Detailed Debug Map mismatch').toBe(expectedDebug);
  });
});
