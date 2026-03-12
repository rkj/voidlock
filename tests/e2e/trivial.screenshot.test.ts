import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getBrowser, closeBrowser, getNewPage } from './utils/puppeteer';
import { captureBaseline, captureAndCompare } from './utils/screenshot';
import * as fs from 'fs';
import * as path from 'path';

describe('Screenshot Utility', () => {
  beforeAll(async () => {
    await getBrowser();
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it('should capture a baseline and compare it successfully', async () => {
    const page = await getNewPage();
    await page.goto('about:blank');
    await page.setContent('<html><body><h1>Test</h1></body></html>');

    const testName = 'trivial_test_snapshot';
    
    // Create baseline
    process.env.UPDATE_SNAPSHOTS = '1';
    await captureAndCompare(page, testName);
    
    // Verify baseline exists
    const baselinePath = path.resolve(__dirname, '__baselines__', `${testName}.png`);
    expect(fs.existsSync(baselinePath)).toBe(true);

    // Compare
    process.env.UPDATE_SNAPSHOTS = '0';
    const diff = await captureAndCompare(page, testName);
    
    // Diff should be 0 or null (if it skipped something) but we expect 0 here
    expect(diff).toBe(0);
    
    // Verify snapshot exists
    const snapshotPath = path.resolve(__dirname, '__snapshots__', `${testName}.png`);
    expect(fs.existsSync(snapshotPath)).toBe(true);
  });
});
