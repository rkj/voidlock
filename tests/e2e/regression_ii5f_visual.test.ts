import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Regression II5F - Unit Style Visibility in Campaign", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should show Visual Style selector in Campaign Mission Setup", async () => {
    // 1. Click "Campaign" on Main Menu
    await page.waitForSelector("#btn-menu-campaign");
    await page.click("#btn-menu-campaign");

    // 2. Click "Initialize Expedition" in Wizard
    const startBtnSelector = ".campaign-setup-wizard .primary-button";
    await page.waitForSelector(startBtnSelector);
    await page.click(startBtnSelector);

    // 3. Click the first accessible node
    const nodeSelector = ".campaign-node.accessible";
    await page.waitForSelector(nodeSelector);
    await page.click(nodeSelector);

    // 4. In Mission Setup
    await page.waitForSelector("#screen-mission-setup");

    // Check if map-config-section is hidden (as expected in Campaign mode)
    const mapConfigVisible = await page.evaluate(() => {
      const el = document.getElementById("map-config-section");
      return el ? window.getComputedStyle(el).display !== "none" : false;
    });
    expect(mapConfigVisible).toBe(false);

    // Check if common-config-section is visible
    const commonConfigVisible = await page.evaluate(() => {
      const el = document.getElementById("common-config-section");
      return el ? window.getComputedStyle(el).display !== "none" : false;
    });
    expect(commonConfigVisible).toBe(true);

    // Check if select-unit-style is visible and interactive
    const styleSelectorVisible = await page.evaluate(() => {
      const el = document.getElementById("select-unit-style");
      return el ? window.getComputedStyle(el).display !== "none" : false;
    });
    expect(styleSelectorVisible).toBe(true);

    // Capture screenshot
    await page.screenshot({
      path: "tests/e2e/__snapshots__/regression_ii5f_verification.png",
    });
  });
});
