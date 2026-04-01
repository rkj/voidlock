import puppeteer, { Browser, Page } from "puppeteer";
import { E2E_PORT } from "../config";

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (browser) return browser;

  browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--window-size=1280,800",
    ],
  });

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
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  
  // Set viewport
  await page.setViewport({ width: 1024, height: 768 });

  // Add E2E flag
  await page.evaluateOnNewDocument(() => {
    (window as any).isE2E = true;
  });

  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  
  return page;
}

/**
 * Sets the locale to en-standard for deterministic E2E test output.
 */
export async function useStandardLocale(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem("voidlock_global_config", JSON.stringify({
      unitStyle: "TacticalIcons",
      themeId: "default",
      locale: "en-standard"
    }));
  });
  await page.reload();
}

export async function closePage(page: Page) {
  const context = page.browserContext();
  await page.close();
  // Don't close the browser itself, just the context if possible.
  // We use try-catch because the default context cannot be closed.
  try {
      await context.close();
  } catch (e) {
      // Ignore
  }
}
