import puppeteer from "puppeteer";
import type { Browser, Page } from "puppeteer";

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--js-flags=--expose-gc",
      ],
    });
  }
  return browser;
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

export async function getNewPage(): Promise<Page> {
  const browser = await getBrowser();
  return await browser.newPage();
}
