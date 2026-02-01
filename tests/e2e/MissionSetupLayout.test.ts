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
    expect(cardStyles?.maxHeight).toBe("80px");
    expect(cardStyles?.overflow).toBe("hidden");

    // 4. Verify .roster-panel scrollability
    const rosterStyles = await page.evaluate(() => {
      const panel = document.querySelector(".roster-panel");
      if (!panel) return null;
      const style = window.getComputedStyle(panel);
      return {
        overflowY: style.overflowY,
        height: style.height
      };
    });

    expect(rosterStyles).not.toBeNull();
    expect(rosterStyles?.overflowY).toBe("auto");

    // 5. Take a screenshot for visual confirmation
    await page.screenshot({
      path: "tests/e2e/__snapshots__/mission_setup_layout_verification.png",
    });
  });
});
