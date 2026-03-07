import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173');
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'ui_check.png' });
  const html = await page.content();
  console.log('HTML Length:', html.length);
  console.log('Button count:', (html.match(/button/g) || []).length);
  await browser.close();
})();
