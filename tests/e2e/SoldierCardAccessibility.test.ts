import { expect, test, describe, beforeAll, afterAll } from "vitest";
import puppeteer, { Browser, Page } from "puppeteer";
import { E2E_PORT } from "./config";

describe("Soldier Card Accessibility", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  });

  afterAll(async () => {
    if (browser) await browser.close();
  });

  test("X button in soldier card is skipped when tabbing", async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768 });
    await page.goto(`http://localhost:${E2E_PORT}/`);

    // Wait for main menu
    await page.waitForSelector("#screen-main-menu");
    
    // Click "Custom Mission" button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const customBtn = btns.find(b => b.textContent?.includes("Custom Mission"));
      if (customBtn) customBtn.click();
      else throw new Error("Custom Mission button not found");
    });

    // Wait for mission setup screen
    await page.waitForSelector("#screen-mission-setup");

    // Wait for roster to load
    await page.waitForSelector(".soldier-card", { timeout: 10000 });

    // Click first soldier to add to squad
    await page.click(".soldier-card");

    // Wait for deployment slot to be occupied
    await page.waitForSelector(".deployment-slot.occupied");

    // Find the soldier card in the deployment slot
    const cardSelector = ".deployment-slot.occupied .soldier-card";
    await page.waitForSelector(cardSelector);

    // Focus the card
    await page.focus(cardSelector);
    
    // Check what is focused
    let focused = await page.evaluate(() => document.activeElement?.className);
    console.log("Initially focused:", focused);
    
    // Now press Tab.
    await page.keyboard.press("Tab");
    
    focused = await page.evaluate(() => document.activeElement?.className);
    console.log("Focused after 1st Tab:", focused);
    
    // If the X button was focusable, it would likely have focus now.
    const isXFocused = await page.evaluate(() => document.activeElement?.classList.contains("slot-remove"));
    expect(isXFocused).toBe(false);
  });
});
