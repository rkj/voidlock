import puppeteer from 'puppeteer';
const E2E_URL = 'http://localhost:5199';

async function capture() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  // 1024x768
  await page.setViewport({ width: 1024, height: 768 });
  await page.goto(E2E_URL, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(E2E_URL, { waitUntil: 'load' });

  // 1. Start Campaign
  await page.waitForSelector('#btn-menu-campaign');
  await page.click('#btn-menu-campaign');
  await page.waitForSelector('.campaign-setup-wizard .primary-button');
  await page.click('#campaign-skip-prologue');
  await page.click('.campaign-setup-wizard .primary-button');

  // 2. Select node
  await page.waitForSelector('.campaign-node.accessible');
  await page.click('.campaign-node.accessible');

  // 3. Equipment Screen
  await page.waitForSelector('#screen-equipment');
  try {
    const advisorBtn = await page.waitForSelector('.advisor-btn', { timeout: 2000 });
    if (advisorBtn) await page.click('.advisor-btn');
  } catch (e) {}

  // Take desktop screenshot
  await page.screenshot({ path: 'audit_1024x768.png' });

  // 400x800
  await page.setViewport({ width: 400, height: 800 });
  // Need to wait for responsive styles to apply?
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'audit_400x800.png' });

  await browser.close();
}

capture().catch(console.error);
