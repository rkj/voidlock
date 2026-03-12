import puppeteer from 'puppeteer';
import { E2E_URL } from './tests/e2e/config';

async function capture() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 400, height: 800 });

  await page.goto(E2E_URL, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(E2E_URL, { waitUntil: 'load' });

  // 1. Start Campaign
  await page.waitForSelector('#btn-menu-campaign');
  await page.click('#btn-menu-campaign');

  const startBtnSelector = '.campaign-setup-wizard .primary-button';
  await page.waitForSelector(startBtnSelector);
  await page.click('#campaign-skip-prologue');
  await page.click(startBtnSelector);

  // 2. Select node
  const nodeSelector = '.campaign-node.accessible';
  await page.waitForSelector(nodeSelector);
  await page.click(nodeSelector);

  // 3. Equipment Screen
  await page.waitForSelector('#screen-equipment');

  // Dismiss advisor
  try {
    const advisorBtn = await page.waitForSelector('.advisor-btn', { timeout: 2000 });
    if (advisorBtn) await page.click('.advisor-btn');
  } catch (e) {}

  // Recruit 5 soldiers to fill roster (total 4+5 = 9)
  // Need to select an empty slot first to see recruit btn in center OR use the new sticky one in right panel
  
  const recruitBtnSelector = '[data-focus-id="recruit-btn-large"]';
  await page.waitForSelector(recruitBtnSelector);
  
  for (let i = 0; i < 5; i++) {
    await page.click(recruitBtnSelector);
    await new Promise(r => setTimeout(r, 200));
    // Click some archetype (Assault) in right panel
    await page.click('[data-focus-id="recruit-assault"]');
    await new Promise(r => setTimeout(r, 200));
  }

  // Take screenshot
  await page.screenshot({ path: 'tests/e2e/__snapshots__/regression_tkzi_sticky_recruit_fixed_400x800.png' });
  await browser.close();
}

capture().catch(console.error);
