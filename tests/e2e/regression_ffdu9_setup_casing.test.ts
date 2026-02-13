import puppeteer, { Browser, Page } from "puppeteer";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { E2E_URL } from "./config";

describe("Mission Setup Casing Repro (voidlock-ffdu9)", () => {
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
