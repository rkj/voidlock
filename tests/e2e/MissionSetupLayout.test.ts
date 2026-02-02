import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Mission Setup Layout Verification", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should have correctly sized soldier cards and scrollable roster", async () => {
    await page.goto(E2E_URL);

    // 1. Navigate to Custom Mission (easiest way to reach setup)
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");

    // 2. Wait for Mission Setup screen
    await page.waitForSelector("#screen-mission-setup");

    // 3. Verify .soldier-card max-height
    const cardStyles = await page.evaluate(() => {
      const card = document.querySelector(".soldier-card");
      if (!card) return null;
      const style = window.getComputedStyle(card);
      return {
        maxHeight: style.maxHeight,
        height: style.height,
        overflow: style.overflow
      };
    });

    expect(cardStyles).not.toBeNull();
    expect(cardStyles?.maxHeight).toBe("none");
    // overflow: hidden is still fine to contain content if needed, but height should be flexible
    
    // 4. Verify .squad-builder-container has flex: 1 or no fixed height
    const containerStyles = await page.evaluate(() => {
      const container = document.querySelector(".squad-builder-container");
      if (!container) return null;
      const style = window.getComputedStyle(container);
      return {
        display: style.display,
        flex: style.flex,
        height: style.height
      };
    });

    expect(containerStyles).not.toBeNull();
    expect(containerStyles?.display).toBe("flex");
    // height should be large enough to show full height
    const heightVal = parseInt(containerStyles?.height || "0");
    expect(heightVal).toBeGreaterThan(400);

    // 5. Take a screenshot for visual confirmation
    await page.screenshot({
      path: "mission_setup_verification.png",
    });
  });
});
