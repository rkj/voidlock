import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Mobile Touch Targets (voidlock-txasb)", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    // Simulate mobile viewport
    await page.setViewport({ width: 400, height: 800, isMobile: true, hasTouch: true });
    // Inject mobile-touch class
    await page.evaluate(() => {
      document.documentElement.classList.add('mobile-touch');
    });
  });

  afterAll(async () => {
    await closeBrowser();
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
    await page.goto(E2E_URL, { waitUntil: "load" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "load" });
    
    // Wait for App to be ready
    await page.waitForFunction(() => (window as any).__VOIDLOCK_READY__ === true);

    // Check main menu buttons
    await page.waitForSelector("#screen-main-menu", { visible: true });
    await checkTouchTargets("#screen-main-menu button", "Main Menu Buttons");

    // Check Equipment Screen (Equipment removal Xs)
    await page.evaluate(() => {
        const btn = document.getElementById("btn-menu-custom");
        if (btn) btn.click();
    });
    await page.waitForSelector("#screen-mission-setup", { visible: true });
    
    await page.evaluate(() => {
        const btn = document.getElementById("btn-goto-equipment");
        if (btn) btn.click();
    });
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
