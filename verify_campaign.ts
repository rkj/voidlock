
import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 768 });

  console.log('Navigating to http://localhost:5173/');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });

  console.log('Clicking Campaign button');
  await page.click('#btn-menu-campaign');

  await new Promise(r => setTimeout(r, 2000));

  // Check if we are on New Campaign Wizard
  const wizard = await page.$('.campaign-setup-wizard');
  if (wizard) {
    console.log('Starting new campaign...');
    await page.click('[data-focus-id="btn-start-campaign"]');
    await new Promise(r => setTimeout(r, 3000));
  }

  const grainCount = (await page.$$('.grain')).length;
  const scanlineCount = (await page.$$('.scanline')).length;
  console.log(`Found ${grainCount} grain elements and ${scanlineCount} scanline elements.`);

  if (grainCount === 0 || scanlineCount === 0) {
    console.error('FAILED: Missing grain or scanline elements!');
  }

  console.log('Taking screenshot of Campaign Screen');
  await page.screenshot({ path: 'campaign_verified.png' });

  await browser.close();
  console.log('Done');
})();
