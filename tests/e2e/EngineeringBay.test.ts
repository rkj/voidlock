import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Engineering Bay E2E Verification", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should display Engineering Bay tab and render content", async () => {
    await page.goto(E2E_URL);

    // 1. Navigate to Campaign
    await page.waitForSelector("#btn-menu-campaign");
    await page.click("#btn-menu-campaign");

    // Give it time to transition
    await new Promise((r) => setTimeout(r, 1000));

    // Check if we are at the wizard or campaign screen
    const isWizard = await page.evaluate(
      () => !!document.querySelector("#screen-new-campaign-wizard"),
    );
    if (isWizard) {
      await page.click(".difficulty-card:nth-child(1)");
      await page.click("#btn-wizard-start");
      await new Promise((r) => setTimeout(r, 1000));
    }

    // 2. Wait for Shell tabs
    await page.waitForSelector(".tab-button", { timeout: 10000 });

    // 3. Verify presence of Engineering tab
    const hasEngineeringTab = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll(".tab-button"));
      return tabs.some((t) => t.textContent === "Engineering");
    });
    expect(hasEngineeringTab).toBe(true);

    // 4. Click Engineering tab
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll(".tab-button"));
      const engTab = tabs.find(
        (t) => t.textContent === "Engineering",
      ) as HTMLElement;
      engTab.click();
    });

    // 5. Wait for Engineering screen
    await page.waitForSelector("#screen-engineering", { timeout: 5000 });

    // 6. Verify Engineering screen content (e.g., headers)
    const headers = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("h3")).map(
        (h) => h.textContent,
      );
    });
    expect(
      headers.some(
        (h) => h?.includes("ARCHETYPES") || h?.includes("EQUIPMENT"),
      ),
    ).toBe(true);

    // 7. Take a screenshot for visual confirmation
    await page.screenshot({
      path: "engineering_bay_verification.png",
    });
  });
});
