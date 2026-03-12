
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

  console.log('Clearing localStorage');
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' });

  console.log('Clicking Campaign button');
  await page.click('#btn-menu-campaign');
  await new Promise(r => setTimeout(r, 1000));

  console.log('URL after Campaign click:', page.url());

  const wizard = await page.$('.campaign-setup-wizard');
  if (wizard) {
    console.log('Found Wizard. Skipping Prologue and Clicking Initialize Expedition.');
    await page.click('#campaign-skip-prologue');
    await page.click('[data-focus-id="btn-start-campaign"]');
    await new Promise(r => setTimeout(r, 3000));
  } else {
    console.log('Wizard NOT found. Maybe campaign already active.');
  }

  console.log('URL after Start click:', page.url());

  const html = await page.content();
  console.log('HTML contains .campaign-map-viewport:', html.includes('campaign-map-viewport'));
  console.log('HTML contains .grain:', html.includes('grain'));
  console.log('HTML contains .scanline:', html.includes('scanline'));

  const grainCount = (await page.$$('.grain')).length;
  console.log(`Grain count: ${grainCount}`);

  await page.screenshot({ path: 'campaign_debug.png', fullPage: true });

  await browser.close();
  console.log('Done');
})();
