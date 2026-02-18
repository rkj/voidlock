import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  try {
    console.log('Navigating to http://localhost:5199...');
    await page.goto('http://localhost:5199');
    
    console.log('Waiting for #btn-menu-custom...');
    await page.waitForSelector('#btn-menu-custom', { timeout: 10000 });
    await page.click('#btn-menu-custom');
    
    console.log('Waiting for #btn-launch-mission...');
    await page.waitForSelector('#btn-launch-mission', { timeout: 10000 });
    
    // Set large map size
    await page.evaluate(() => {
      const widthInput = document.getElementById('map-width');
      const heightInput = document.getElementById('map-height');
      if (widthInput) (widthInput as HTMLInputElement).value = '50';
      if (heightInput) (heightInput as HTMLInputElement).value = '50';
      widthInput?.dispatchEvent(new Event('input', { bubbles: true }));
      heightInput?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    
    console.log('Launching mission...');
    await page.click('#btn-launch-mission');
    
    console.log('Waiting for #screen-mission...');
    await page.waitForSelector('#screen-mission', { visible: true, timeout: 30000 });
    
    console.log('Mission screen visible!');
    
    const hasScrollbars = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      return {
        docScrollHeight: doc.scrollHeight,
        docClientHeight: doc.clientHeight,
        bodyScrollHeight: body.scrollHeight,
        bodyClientHeight: body.clientHeight,
        hasScroll: doc.scrollHeight > doc.clientHeight || body.scrollHeight > body.clientHeight
      };
    });
    
    console.log('Scroll info:', hasScrollbars);
    
    const missionRect = await page.evaluate(() => {
      const el = document.getElementById('screen-mission');
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      };
    });
    
    console.log('Mission rect:', missionRect);
    
    await page.screenshot({ path: 'screenshots/repro_lds73.png' });
    console.log('Screenshot saved to screenshots/repro_lds73.png');

  } catch (err) {
    console.error('ERROR:', err);
    await page.screenshot({ path: 'screenshots/repro_lds73_error.png' });
  } finally {
    await browser.close();
  }
})();
