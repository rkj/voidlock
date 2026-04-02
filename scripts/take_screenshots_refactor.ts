import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function takeScreenshots() {
  console.log('Starting dev server...');
  const devServer = spawn('npm', ['run', 'dev', '--', '--port', '5199'], {
    cwd: join(__dirname, '..'),
    stdio: 'ignore',
    detached: true,
  });

  const url = 'http://localhost:5199';
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  // Wait for server to be ready
  let attempts = 0;
  while (attempts < 30) {
    try {
      await page.goto(url);
      console.log('Server is ready');
      break;
    } catch (e) {
      attempts++;
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  if (attempts === 30) {
    console.error('Server failed to start');
    process.exit(1);
  }

  // 1024x768
  await page.setViewport({ width: 1024, height: 768 });
  await new Promise(r => setTimeout(r, 2000)); // wait for animations
  await page.screenshot({ path: 'screenshots/hud_1024x768.png' });
  console.log('Saved screenshots/hud_1024x768.png');

  // 400x800
  await page.setViewport({ width: 400, height: 800 });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'screenshots/hud_400x800.png' });
  console.log('Saved screenshots/hud_400x800.png');

  await browser.close();
  
  if (devServer.pid) {
    process.kill(-devServer.pid);
  }
}

takeScreenshots().catch(err => {
  console.error(err);
  process.exit(1);
});
