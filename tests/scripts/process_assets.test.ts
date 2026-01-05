import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { processAssets } from '../../scripts/process_assets';

describe('Asset Pipeline', () => {
  const outputDir = 'tests/public/assets';

  afterAll(() => {
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('should process assets and generate manifest', async () => {
    await processAssets(outputDir);
    const manifestPath = path.join(outputDir, 'assets.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.floor).toMatch(/assets\/floor\.(webp|png)/);
    const floorFile = manifest.floor.replace('assets/', '');
    expect(fs.existsSync(path.join(outputDir, floorFile))).toBe(true);
    
    // Check for some other assets
    expect(manifest.soldier_heavy).toMatch(/assets\/soldier_heavy\.(webp|png)/);
    const soldierFile = manifest.soldier_heavy.replace('assets/', '');
    expect(fs.existsSync(path.join(outputDir, soldierFile))).toBe(true);

    console.log('Processed assets:', Object.keys(manifest).length);
  }, 30000);
});
