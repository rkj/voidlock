import puppeteer, { Browser, Page } from "puppeteer";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { E2E_URL } from "./config";

describe("Mobile Touch Targets (voidlock-txasb)", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    page = await browser.newPage();
    // Simulate mobile viewport
    await page.setViewport({ width: 400, height: 800, isMobile: true, hasTouch: true });
    // Inject mobile-touch class
    await page.evaluateOnNewDocument(() => {
      document.documentElement.classList.add('mobile-touch');
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  const checkTouchTargets = async (selector: string, context: string) => {
    const elements = await page.$$(selector);
    for (const el of elements) {
      const isVisible = await page.evaluate((e) => {
        const style = window.getComputedStyle(e);
        return style.display !== 'none' && style.visibility !== 'hidden' && e.offsetWidth > 0;
      }, el);
      
      if (!isVisible) continue;

      const rect = await page.evaluate((e) => {
        const r = e.getBoundingClientRect();
        return { width: r.width, height: r.height };
      }, el);

      if (rect.width < 44 || rect.height < 44) {
        const text = await page.evaluate((e) => e.textContent, el);
        throw new Error(`Touch target too small in ${context}: "${text?.trim()}" (${rect.width}x${rect.height}) (Selector: ${selector})`);
      }
    }
  };

  test("Mobile interactive elements should meet 44x44px requirement", async () => {
    await page.goto(E2E_URL, { waitUntil: "networkidle0" });
    
    // Check main menu buttons
    await page.waitForSelector("#screen-main-menu", { visible: true });
    await checkTouchTargets("#screen-main-menu button", "Main Menu Buttons");

    // Check Equipment Screen (Equipment removal Xs)
    await page.click("#btn-menu-custom");
    await page.waitForSelector("#screen-mission-setup", { visible: true });
    await page.click("#btn-goto-equipment");
    await page.waitForSelector("#screen-equipment", { visible: true });
    
    // Select first soldier in roster to see inspector
    await page.waitForSelector(".soldier-item");
    await page.click(".soldier-item");
    await page.waitForSelector(".paper-doll-slot", { visible: true });

    await page.screenshot({ path: "debug_mobile_equipment.png" });
    
    // Check equipment removal Xs if any
    await checkTouchTargets(".slot-remove-btn", "Equipment Removal Xs");
    await checkTouchTargets(".paper-doll-slot", "Paper Doll Slots");
    await checkTouchTargets(".armory-item", "Armory Items");
  });
});
