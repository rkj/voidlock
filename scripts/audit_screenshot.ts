import puppeteer from 'puppeteer';
import fs from 'fs';

async function audit() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  const results: any = {};

  async function capture(name: string) {
    await page.screenshot({ path: `audit_${name}.png` });
    results[name] = {
        url: page.url(),
        title: await page.title(),
        elements: await page.evaluate(() => {
            const elNames = ['#main-menu', '#settings-screen', '#campaign-screen', '#barracks-screen', '#equipment-screen', '#mission-setup-screen', '#tactical-screen', '#debrief-screen'];
            const found: any = {};
            elNames.forEach(id => {
                const el = document.querySelector(id);
                if (el) {
                    const style = window.getComputedStyle(el);
                    found[id] = {
                        visible: style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0,
                        text: (el as HTMLElement).innerText.substring(0, 100).replace(/\n/g, ' ')
                    };
                }
            });
            return found;
        })
    };
  }

  console.log('Navigating to Main Menu...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await capture('main_menu');

  // Navigate to Settings
  console.log('Navigating to Settings...');
  const settingsBtn = await page.waitForSelector('button#btn-settings', { timeout: 5000 });
  await settingsBtn?.click();
  await new Promise(r => setTimeout(r, 500));
  await capture('settings');

  // Back to Main Menu
  console.log('Back to Main Menu...');
  const settingsBackBtn = await page.waitForSelector('#settings-screen button.back-button, #settings-screen button#btn-settings-back', { timeout: 5000 });
  await settingsBackBtn?.click();
  await new Promise(r => setTimeout(r, 500));

  // Navigate to Statistics (Service Record)
  console.log('Navigating to Statistics...');
  const statsBtn = await page.waitForSelector('button#btn-stats', { timeout: 5000 });
  await statsBtn?.click();
  await new Promise(r => setTimeout(r, 500));
  await capture('statistics');

  // Back to Main Menu
  const statsBackBtn = await page.waitForSelector('button#btn-stats-back, .back-button', { timeout: 5000 });
  await statsBackBtn?.click();
  await new Promise(r => setTimeout(r, 500));

  // Navigate to Custom Mission (Mission Setup)
  console.log('Navigating to Custom Mission Setup...');
  const customBtn = await page.waitForSelector('button#btn-custom-mission', { timeout: 5000 });
  await customBtn?.click();
  await new Promise(r => setTimeout(r, 500));
  await capture('custom_setup');

  // Navigate to Campaign
  console.log('Navigating to Campaign...');
  await page.goto('http://localhost:5173#campaign', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  await capture('campaign_hub');

  fs.writeFileSync('audit_results.json', JSON.stringify(results, null, 2));
  await browser.close();
}

audit().catch(console.error);