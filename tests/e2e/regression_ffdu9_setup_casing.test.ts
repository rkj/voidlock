import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Mission Setup Casing Repro (voidlock-ffdu9)", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  test("Mission setup context header should be Title Case", async () => {
    await page.goto(E2E_URL, { waitUntil: "networkidle0" });
    
    // Start a custom mission
    console.log("Navigating to Custom Mission Setup...");
    await page.waitForSelector("#btn-menu-custom", { visible: true });
    await page.click("#btn-menu-custom");
    
    await page.waitForSelector("#mission-setup-context", { visible: true });
    const contextText = await page.$eval("#mission-setup-context", (el) => el.textContent);
    console.log(`Context Header: "${contextText}"`);
    
    expect(contextText).toBe("Custom Simulation");
    
    // Take screenshot
    await page.screenshot({ path: "screenshots/voidlock-ffdu9-mission-setup-fixed.png" });
  });
});
