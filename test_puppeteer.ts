import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Set viewports
  const viewports = [
    { name: 'desktop', width: 1024, height: 768 },
    { name: 'mobile', width: 400, height: 800 }
  ];

  try {
    console.log('Navigating to http://localhost:5173/');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
    
    // Wait for main menu
    await page.waitForSelector('button', { timeout: 10000 });
    
    // Find and click Settings button
    // The settings button should be visible in the main menu
    const buttons = await page.$$('button');
    let settingsBtn;
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Settings')) {
        settingsBtn = btn;
        break;
      }
    }
    
    if (settingsBtn) {
      console.log('Clicking Settings button');
      await settingsBtn.click();
      await new Promise(r => setTimeout(r, 1000)); // Wait for transition
    } else {
      console.log('Settings button not found, trying hash navigation');
      await page.goto('http://localhost:5173/#settings', { waitUntil: 'networkidle0' });
    }

    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await new Promise(r => setTimeout(r, 500));
      const path = `settings_${vp.name}.png`;
      await page.screenshot({ path });
      console.log(`Saved screenshot: ${path}`);
    }

  } catch (err) {
    console.error('Error:', err);
    // Take an emergency screenshot if possible
    await page.screenshot({ path: 'error_screenshot.png' });
  } finally {
    await browser.close();
  }
})();
