import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Equipment Screen Navigation", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should navigate back to Mission Setup after confirming squad", async () => {
    await page.goto(E2E_URL);

    // 1. Enter Custom Mission Setup
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");
    await page.waitForSelector("#screen-mission-setup");

    // 2. Go to Equipment Screen
    await page.waitForSelector("#btn-goto-equipment");
    await page.click("#btn-goto-equipment");
    await page.waitForSelector("#screen-equipment");

    // 3. Confirm Squad
    await page.waitForSelector('[data-focus-id="btn-confirm-squad"]');
    await page.click('[data-focus-id="btn-confirm-squad"]');
    
    // 4. Verify we returned to Mission Setup
    // Wait for Mission Setup to be visible
    await page.waitForFunction(() => {
        const el = document.getElementById("screen-mission-setup");
        return el && el.style.display !== "none";
    });
    
    // Verify we are NOT in game
    const missionScreenVisible = await page.evaluate(() => {
        const el = document.getElementById("screen-mission");
        if (!el) return false;
        const display = window.getComputedStyle(el).display;
        return display !== "none";
    });
    expect(missionScreenVisible).toBe(false);
  });
});
