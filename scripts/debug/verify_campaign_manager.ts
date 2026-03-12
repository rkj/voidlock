import puppeteer from 'puppeteer';

(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768 });

    console.log('Navigating to http://localhost:5199/');
    await page.goto('http://localhost:5199/', { waitUntil: 'networkidle2' });

    console.log('Clearing localStorage');
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });

    console.log('Clicking Campaign button');
    await page.waitForSelector('#btn-menu-campaign', { visible: true });
    await page.click('#btn-menu-campaign');

    console.log('Waiting for wizard and skipping prologue...');
    await page.waitForSelector('.campaign-setup-wizard', { visible: true });
    
    // Check 'Skip Tutorial Prologue'
    const skipCheckbox = await page.$('#campaign-skip-prologue');
    if (skipCheckbox) {
      await skipCheckbox.click();
    }

    console.log('Clicking Initialize Expedition...');
    await page.click('[data-focus-id="btn-start-campaign"]');

    console.log('Waiting for campaign-map-viewport...');
    await page.waitForSelector('.campaign-map-viewport', { visible: true, timeout: 5000 });

    console.log('Evaluating styles and DOM structure...');
    const result = await page.evaluate(() => {
      const viewport = document.querySelector('.campaign-map-viewport') as HTMLElement;
      if (!viewport) return { error: 'No viewport found' };
      
      const styles = window.getComputedStyle(viewport);
      const bgImage = styles.backgroundImage;
      
      const grain = viewport.querySelector('.grain');
      const scanline = viewport.querySelector('.scanline');
      
      return {
        bgImage,
        hasGrain: !!grain,
        hasScanline: !!scanline,
        grainParent: grain?.parentElement?.className,
        scanlineParent: scanline?.parentElement?.className
      };
    });

    console.log('Result:', result);

    if (result.bgImage && result.bgImage.includes('station.jpg')) {
      console.log('SUCCESS: background-image is set correctly.');
    } else {
      console.error('FAILED: background-image is incorrect.');
    }

    if (result.hasGrain && result.hasScanline) {
      console.log('SUCCESS: grain and scanline elements are present inside the viewport.');
    } else {
      console.error('FAILED: grain or scanline elements are missing.');
    }

    console.log('Taking 1024x768 screenshot...');
    await page.screenshot({ path: 'campaign_verification_1024.png' });

    await page.setViewport({ width: 400, height: 800 });
    console.log('Taking 400x800 screenshot...');
    await page.screenshot({ path: 'campaign_verification_400.png' });

    await browser.close();
    console.log('Verification Complete.');
  } catch (err) {
    console.error('Error during verification:', err);
    process.exit(1);
  }
})();
