import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Reproduction: HUD All-caps labels (voidlock-8ai79)", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  const checkIsTitleCase = async (selector: string, expectedText: string) => {
    const text = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        return el.textContent?.trim();
    }, selector);
    
    if (text === null) {
        throw new Error(`Element ${selector} not found`);
    }
    
    // We now expect Title Case per Spec 11.1
    expect(text).toBe(expectedText);
    
    // Verify it's NOT forced to uppercase by CSS
    const isUppercaseCSS = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        return window.getComputedStyle(el).textTransform === "uppercase";
    }, selector);
    
    expect(isUppercaseCSS).toBe(false);
  };

  test("HUD labels like Deployment Phase, Start Mission, and Objectives should be Title Case", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Go to Mission Setup
    await page.waitForSelector("#btn-menu-custom", { visible: true });
    await page.click("#btn-menu-custom");
    
    // MUST go to Equipment Screen to select units now
    await page.waitForSelector("#btn-goto-equipment", { visible: true });
    await page.click("#btn-goto-equipment");

    // Select a unit to allow launching
    await page.waitForSelector(".soldier-widget-roster.clickable", { visible: true });
    await page.click(".soldier-widget-roster.clickable");
    
    // Confirm Squad
    const confirmBtn = await page.waitForSelector("::-p-text(Confirm Squad)");
    if (!confirmBtn) throw new Error("Confirm Squad button not found");
    await confirmBtn.click();

    // Launch Mission (Deployment Phase)
    await page.waitForSelector("#btn-launch-mission", { visible: true });
    await page.click("#btn-launch-mission");
    
    await page.waitForSelector("#screen-mission", { visible: true });
    await new Promise(r => setTimeout(r, 1000));
    
    // 1. Check Deployment Phase Title
    await checkIsTitleCase(".deployment-title", "Deployment Phase");
    
    // Autofill deployment
    await page.waitForSelector("#btn-autofill-deployment", { visible: true });
    await page.click("#btn-autofill-deployment");

    // 2. Check Start Mission Button
    await page.waitForSelector("#btn-start-mission:not([disabled])", { visible: true });
    await checkIsTitleCase("#btn-start-mission", "Start Mission");
    
    // Start Mission to see Objectives
    await page.click("#btn-start-mission");
    await page.waitForSelector(".objectives-status h3", { visible: true });
    
    // 3. Check Objectives Header
    await checkIsTitleCase(".objectives-status h3", "Objectives");

    // 4. Check Enemy Intel Header
    await checkIsTitleCase(".enemy-intel h3", "Enemy Intel");
  });
});
