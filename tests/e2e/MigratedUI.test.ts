import { test } from 'vitest';
import puppeteer from 'puppeteer';

test('Capture migrated UI screenshots', async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  const url = 'http://localhost:5199'; // vitest-preview or similar might be running on 5173 or 5199

  // The vitest config for e2e starts the server.
  // We can try to use the one started by vitest.
  // Actually, vitest.config.e2e.ts should have the webServer config.
  
  await page.goto(url, { waitUntil: 'networkidle0' });

  // 1024x768
  await page.setViewport({ width: 1024, height: 768 });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'screenshots/migrated_ui_1024x768.png' });

  // 400x800
  await page.setViewport({ width: 400, height: 800 });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'screenshots/migrated_ui_400x800.png' });

  await browser.close();
}, 60000);
