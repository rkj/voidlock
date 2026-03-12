import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 768 });

  console.log('Navigating to campaign screen...');
  // Ensure we start with a clean slate (no campaign)
  await page.goto('http://localhost:5199/');
  await page.evaluate(() => {
    localStorage.removeItem('voidlock_campaign_v1');
    localStorage.removeItem('voidlock_campaign_config');
  });
  await page.goto('http://localhost:5199/#campaign');

  await new Promise(r => setTimeout(r, 2000));

  console.log('Checking for New Campaign Wizard...');
  const wizardTitle = await page.evaluate(() => {
    return document.querySelector('h1')?.textContent;
  });
  console.log('Title:', wizardTitle);

  console.log('Checking for Campaign Length selection...');
  const lengthSelect = await page.evaluate(() => {
    return document.getElementById('campaign-length');
  });
  console.log('Length select exists:', !!lengthSelect);

  if (lengthSelect) {
    console.error('FAIL: Campaign Length selection still exists!');
  } else {
    console.log('PASS: Campaign Length selection removed.');
  }

  await page.screenshot({ path: 'wizard_audit.png' });
  console.log('Screenshot saved to wizard_audit.png');

  await browser.close();
})();
