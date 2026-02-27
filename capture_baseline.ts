
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
    await page.click('#btn-launch-campaign'); // Assuming this starts the campaign
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('Taking screenshot of Campaign Screen');
  await page.screenshot({ path: 'campaign_baseline.png' });

  await browser.close();
  console.log('Done');
})();
