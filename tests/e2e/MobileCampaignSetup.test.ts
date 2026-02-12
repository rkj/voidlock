import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Mobile Campaign Setup Scrollability", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 400, height: 800 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should ensure the 'Initialize Expedition' button is reachable on mobile", async () => {
    await page.goto(E2E_URL);

    // 1. Navigate to Campaign
    await page.waitForSelector("#btn-menu-campaign");
    await page.click("#btn-menu-campaign");

    // 2. Wait for New Campaign Wizard
    await page.waitForSelector(".campaign-setup-wizard");

    // 3. Take a screenshot for visual verification
    await page.screenshot({
      path: "tests/e2e/__snapshots__/mobile_campaign_setup_verification.png",
    });

    // 4. Check if the "Initialize Expedition" button is in the viewport (it should be in sticky footer)
    const isButtonInViewport = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button.primary-button"));
      const btn = buttons.find(b => b.textContent?.includes("Initialize Expedition"));
      if (!btn) return false;
      
      const rect = btn.getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
      );
    });

    expect(isButtonInViewport, "Start button should be in viewport (sticky footer)").toBe(true);

    // 5. Check if the internal container is scrollable
    const isScrollable = await page.evaluate(() => {
      const scrollContainer = document.querySelector(".campaign-setup-wizard div.overflow-y-auto");
      if (!scrollContainer) return false;
      return scrollContainer.scrollHeight > scrollContainer.clientHeight;
    });

    expect(isScrollable, "Internal content should be scrollable on mobile").toBe(true);
  });
});
