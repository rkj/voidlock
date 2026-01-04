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
    expect(manifest.floor).toBe('assets/floor.png');
    expect(fs.existsSync(path.join(outputDir, 'floor.png'))).toBe(true);
    
    // Check for some other assets
    expect(manifest.soldier_heavy).toBe('assets/soldier_heavy.png');
    expect(fs.existsSync(path.join(outputDir, 'soldier_heavy.png'))).toBe(true);

    console.log('Processed assets:', Object.keys(manifest).length);
  }, 30000);
});
