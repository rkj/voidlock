import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Settings Screen E2E Verification", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should display Developer Options and Data Management in Settings screen", async () => {
    await page.goto(E2E_URL);

    // 1. Navigate to Settings
    await page.waitForSelector("#btn-menu-settings");
    await page.click("#btn-menu-settings");

    // 2. Wait for Settings screen
    await page.waitForSelector("#screen-settings");

    // 3. Verify presence of Developer Options header
    const hasDevHeader = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll("h3"));
      return headers.some((h) => h.textContent === "Developer Options");
    });
    expect(hasDevHeader).toBe(true);

    // 4. Verify log level select
    const hasLogSelect = await page.evaluate(() => {
      return !!document.querySelector("#settings-log-level");
    });
    expect(hasLogSelect).toBe(true);

    // 5. Verify presence of Data Management header
    const hasDataHeader = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll("h3"));
      return headers.some((h) => h.textContent === "Data Management");
    });
    expect(hasDataHeader).toBe(true);

    // 6. Verify reset button exists
    const hasResetBtn = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      return buttons.some((b) => b.textContent === "Reset All Data");
    });
    expect(hasResetBtn).toBe(true);

    // 7. Take a screenshot for visual confirmation
    await page.screenshot({
      path: "settings_verification.png",
    });
  });
});
