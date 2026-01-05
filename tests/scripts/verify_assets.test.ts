import { processAssets } from '../../scripts/process_assets';
import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

describe('Asset Processor', () => {
  it('should process assets and generate manifest', async () => {
    const outputDir = 'public/assets_test';
    
    // Clean up if exists
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }

    await processAssets(outputDir);

    expect(fs.existsSync(outputDir)).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'assets.json'))).toBe(true);
    
    const manifest = JSON.parse(fs.readFileSync(path.join(outputDir, 'assets.json'), 'utf-8'));
    expect(Object.keys(manifest).length).toBeGreaterThan(0);
    
    // Check for floor (might be .webp or .png depending on sharp)
    expect(manifest.floor).toMatch(/assets\/floor\.(webp|png)/);
    const targetFile = manifest.floor.replace('assets/', '');
    expect(fs.existsSync(path.join(outputDir, targetFile))).toBe(true);

    // Clean up
    fs.rmSync(outputDir, { recursive: true, force: true });
  }, 20000); // Higher timeout for image processing
});
