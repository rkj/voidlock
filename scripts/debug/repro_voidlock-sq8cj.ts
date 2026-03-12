import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER:', msg.text()));

  try {
    await page.goto('http://localhost:5199');
    await page.waitForSelector('#btn-menu-custom');
    await page.click('#btn-menu-custom');

    await page.waitForSelector('#screen-mission-setup', { visible: true });
    
    // Take screenshot of setup
    await page.screenshot({ path: 'debug_setup.png' });
    console.log('Took screenshot: debug_setup.png');

    // Check if button is there and its state
    const btnState = await page.evaluate(() => {
        const btn = document.getElementById('btn-goto-equipment');
        if (!btn) return 'NOT FOUND';
        return {
            visible: btn.offsetParent !== null,
            disabled: (btn as HTMLButtonElement).disabled,
            display: btn.style.display,
            innerText: btn.innerText
        };
    });
    console.log('Button state:', btnState);

    // Check squad count
    const squadCount = await page.evaluate(() => {
        const el = document.getElementById('squad-total-count');
        return el ? el.innerText : 'NOT FOUND';
    });
    console.log('Squad count:', squadCount);

    // Click a soldier
    await page.waitForSelector('.roster-list .soldier-card');
    await page.click('.roster-list .soldier-card');
    
    await new Promise(r => setTimeout(r, 500));
    
    const btnStateAfter = await page.evaluate(() => {
        const btn = document.getElementById('btn-goto-equipment');
        if (!btn) return 'NOT FOUND';
        return {
            visible: btn.offsetParent !== null,
            disabled: (btn as HTMLButtonElement).disabled,
            innerText: btn.innerText
        };
    });
    console.log('Button state after click:', btnStateAfter);

    await page.screenshot({ path: 'debug_setup_after_click.png' });

  } catch (e) {
    console.error(e);
  } finally {
    await browser.close();
  }
})();
