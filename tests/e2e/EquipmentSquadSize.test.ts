import puppeteer, { Browser, Page } from "puppeteer";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { E2E_URL } from "./config";

describe("Equipment Screen Squad Size E2E", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await browser.close();
  });

  it("should allow selecting 4 soldiers in a new campaign", async () => {
    try {
      await page.goto(E2E_URL, { waitUntil: "load" });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: "load" });

      await page.screenshot({ path: "debug_main_menu.png" });
      
      const bodyText = await page.evaluate(() => document.body.innerText);
      console.log("Body text:", bodyText);

      // 1. Click Campaign in Main Menu
      await page.waitForSelector('#btn-menu-campaign', { timeout: 10000 });
      await page.click('#btn-menu-campaign');

      // 2. Click Initialize Expedition in Wizard
      await page.waitForSelector('[data-focus-id="btn-start-campaign"]', { timeout: 5000 });
      await page.screenshot({ path: "step2_wizard.png" });
      await page.click('[data-focus-id="btn-start-campaign"]');

      // 3. Wait for Campaign Screen (Sector Map)
      await page.waitForSelector(".campaign-screen");

      // 4. Click the first node (Prologue)
      await page.waitForSelector('[data-focus-id="node-0"]');
      await page.click('[data-focus-id="node-0"]');

      // 5. Should now be in Equipment Screen (Ready Room)
      await page.waitForSelector(".equipment-screen");

      // 6. Verify 4 slots are present
      const slots = await page.$$(".soldier-list-panel [data-focus-id^='soldier-slot-']");
      expect(slots.length).toBe(4);

      // Take screenshot of the fixed state
      await page.screenshot({ path: "squad_size_verification_1024.png" });
      
      // Mobile Viewport Check
      await page.setViewport({ width: 400, height: 800 });
      await page.screenshot({ path: "squad_size_verification_mobile.png" });

    } catch (err) {
      await page.screenshot({ path: "squad_size_error.png" });
      throw err;
    }
  }, 60000);
});
