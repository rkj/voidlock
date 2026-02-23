/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Tap-to-Inspect E2E", () => {
  let page: Page;

  beforeEach(async () => {
    page = await getNewPage();
    await page.setViewport({
      width: 375,
      height: 667,
      isMobile: true,
      hasTouch: true,
    });
    // Ensure clean state
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  }, 30000);

  afterEach(async () => {
    // We don't close browser between tests in this suite to save time
    // but we can close page if needed.
    // Actually our utils handle browser lifecycle.
  });

  it("should show popover on stat icon tap", async () => {
    await page.goto(E2E_URL);

    // 1. Click "Campaign" on Main Menu
    await page.waitForSelector("#btn-menu-campaign");
    await page.click("#btn-menu-campaign");

    // 2. New Campaign Wizard should be visible. Click "Initialize Expedition"
    const startBtnSelector = ".campaign-setup-wizard .primary-button";
    await page.waitForSelector(startBtnSelector);
    await page.click(startBtnSelector);

    // 3. Wait for the Sector Map
    await page.waitForSelector(".campaign-screen");

    // 4. Go to Ready Room (formerly Barracks)
    await page.waitForSelector(".tab-button[data-id='ready-room']");
    await page.click(".tab-button[data-id='ready-room']");

    await page.waitForSelector(".equipment-screen");
    await page.waitForSelector(".stat-display[data-tooltip]");

    const statIcon = await page.$(".stat-display[data-tooltip]");
    await statIcon!.scrollIntoView();

    const iconBoundingBox = await statIcon!.boundingBox();

    // Tap on the icon
    await page.touchscreen.tap(
      iconBoundingBox!.x + iconBoundingBox!.width / 2,
      iconBoundingBox!.y + iconBoundingBox!.height / 2,
    );

    // 5. Verify Popover
    await page.waitForSelector(".inspect-popover", { timeout: 5000 });

    const popoverData = await page.evaluate(() => {
      const popover = document.querySelector(".inspect-popover") as HTMLElement;
      if (!popover) return null;
      const style = window.getComputedStyle(popover);
      return {
        exists: true,
        opacity: style.opacity,
        text: popover.textContent,
      };
    });

    expect(popoverData).not.toBeNull();
    expect(popoverData?.exists).toBe(true);
    expect(popoverData?.text).toBe("Max Health");

    // 6. Tap outside to dismiss
    await page.touchscreen.tap(10, 10);
    await page.waitForFunction(
      () => !document.querySelector(".inspect-popover"),
    );

    const popoverGone = await page.evaluate(
      () => document.querySelector(".inspect-popover") === null,
    );
    expect(popoverGone).toBe(true);
  });
});
