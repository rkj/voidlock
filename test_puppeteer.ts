import puppeteer from 'puppeteer';

async function test() {
  console.log('Testing puppeteer...');
  try {
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    console.log('Puppeteer launched successfully!');
    await browser.close();
  } catch (error) {
    console.error('Puppeteer launch failed:', error);
  }
}

test();
