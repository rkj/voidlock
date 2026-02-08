import puppeteer, { Browser, Page } from "puppeteer";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { E2E_URL } from "./config";

describe("Tap-to-Inspect E2E", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    page = await browser.newPage();
    await page.setViewport({
      width: 375,
      height: 667,
      isMobile: true,
      hasTouch: true,
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  it("should show popover on stat icon tap", async () => {
    await page.goto(E2E_URL);

    // Set mobile-touch class manually to simulate mobile environment detection
    await page.evaluate(() => {
      document.body.classList.add("mobile-touch");
    });

    // Start a new campaign
    await page.waitForSelector("#btn-menu-campaign");
    await page.click("#btn-menu-campaign");
    await page.waitForSelector(".campaign-setup-wizard .primary-button");
    await page.click(".campaign-setup-wizard .primary-button");

    // Navigate to Barracks
    await page.waitForSelector('.shell-tab[data-id="barracks"]');
    await page.click('.shell-tab[data-id="barracks"]');

    // Wait for stat icons to appear in recruitment
    try {
      await page.waitForSelector(".stat-display[data-tooltip]", {
        timeout: 15000,
      });
    } catch (e) {
      const html = await page.evaluate(() => document.body.innerHTML);
      console.log("DEBUG BARRACKS HTML:", html.substring(0, 2000));
      throw e;
    }

    const statIcon = await page.$(".stat-display[data-tooltip]");
    const iconBoundingBox = await statIcon!.boundingBox();

    // Tap on the icon
    await page.touchscreen.tap(
      iconBoundingBox!.x + iconBoundingBox!.width / 2,
      iconBoundingBox!.y + iconBoundingBox!.height / 2,
    );

    await page.waitForSelector(".inspect-popover");
    const popoverVisible = await page.evaluate(() => {
      const popover = document.querySelector(".inspect-popover");
      return (
        popover !== null && window.getComputedStyle(popover).opacity !== "0"
      );
    });

    expect(popoverVisible).toBe(true);

    // Take screenshot for manual verification if needed
    await page.screenshot({
      path: "screenshots/tap_to_inspect_verification.png",
    });

    // Tap outside to dismiss
    await page.touchscreen.tap(10, 10);
    const popoverGone = await page.evaluate(
      () => document.querySelector(".inspect-popover") === null,
    );
    expect(popoverGone).toBe(true);
  });
});
