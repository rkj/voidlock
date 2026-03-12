import { Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASELINES_DIR = path.resolve(__dirname, '../__baselines__');
const SNAPSHOTS_DIR = path.resolve(__dirname, '../__snapshots__');

if (!fs.existsSync(BASELINES_DIR)) {
  fs.mkdirSync(BASELINES_DIR, { recursive: true });
}
if (!fs.existsSync(SNAPSHOTS_DIR)) {
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
}

export async function captureBaseline(page: Page, name: string): Promise<void> {
  const filePath = path.join(BASELINES_DIR, `${name}.png`);
  await page.screenshot({ path: filePath });
}

export async function captureAndCompare(page: Page, name: string): Promise<number | null> {
  const baselinePath = path.join(BASELINES_DIR, `${name}.png`);
  const snapshotPath = path.join(SNAPSHOTS_DIR, `${name}.png`);

  if (process.env.UPDATE_SNAPSHOTS === '1') {
    await captureBaseline(page, name);
    return null;
  }

  await page.screenshot({ path: snapshotPath });

  if (!fs.existsSync(baselinePath)) {
    console.warn(`Baseline for ${name} does not exist. Use UPDATE_SNAPSHOTS=1 to create it.`);
    return null;
  }

  const img1 = await sharp(baselinePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const img2 = await sharp(snapshotPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const { data: data1, info: info1 } = img1;
  const { data: data2, info: info2 } = img2;

  if (info1.width !== info2.width || info1.height !== info2.height) {
    console.warn(`Dimensions mismatch for ${name}: baseline is ${info1.width}x${info1.height}, snapshot is ${info2.width}x${info2.height}`);
    return 100; // 100% diff due to dimension mismatch
  }

  let diffPixels = 0;
  for (let i = 0; i < data1.length; i += 4) {
    if (Math.abs(data1[i] - data2[i]) > 10 || 
        Math.abs(data1[i+1] - data2[i+1]) > 10 || 
        Math.abs(data1[i+2] - data2[i+2]) > 10 ||
        Math.abs(data1[i+3] - data2[i+3]) > 10) {
      diffPixels++;
    }
  }

  const totalPixels = info1.width * info1.height;
  return (diffPixels / totalPixels) * 100;
}
