import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Mission Setup Campaign Mode Visibility", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
  });

  beforeEach(async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => {
        localStorage.clear();
        window.location.hash = "";
    });
    await page.goto(E2E_URL);
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should hide map configuration when entering from campaign", async () => {
    await page.goto(E2E_URL);

    // 1. Start Campaign
    await page.waitForSelector("#btn-menu-campaign");
    await page.click("#btn-menu-campaign");
    await page.waitForSelector(".campaign-setup-wizard .primary-button");
    await page.click(".campaign-setup-wizard .primary-button");

    // 2. Select Node
    const nodeSelector = ".campaign-node.accessible";
    await page.waitForSelector(nodeSelector);
    await page.click(nodeSelector);

    // 3. We should be in Equipment screen
    await page.waitForSelector("#screen-equipment");

    // 4. Click Confirm Squad
    // We need to find the button with text "Confirm Squad"
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("#screen-equipment button"));
        const confirmBtn = buttons.find(b => b.textContent?.includes("Confirm Squad")) as HTMLButtonElement;
        if (confirmBtn) confirmBtn.click();
    });

    // 5. Now we should be in Mission Setup
    await page.waitForSelector("#screen-mission-setup");

    // REPRODUCTION ASSERTIONS:
    // These are expected to FAIL based on the bug report

    // A. Check if the title is "Mission Briefing"
    const titleText = await page.evaluate(() => {
        const h1 = document.getElementById("mission-setup-title");
        return h1 ? h1.textContent : "not found";
    });
    expect(titleText).toBe("Mission Briefing");

    // B. Check if map-config-section is visible (it should NOT be)
    const configVisible = await page.evaluate(() => {
        const section = document.getElementById("map-config-section");
        if (!section) return false;
        const style = window.getComputedStyle(section);
        return style.display !== "none" && style.visibility !== "hidden";
    });
    expect(configVisible).toBe(false);

    // C. Check if "Equipment & Supplies" button is visible in Mission Setup (it should NOT be)
    const equipmentBtnVisible = await page.evaluate(() => {
        const btn = document.getElementById("btn-goto-equipment");
        if (!btn) return false;
        const style = window.getComputedStyle(btn);
        return style.display !== "none" && style.visibility !== "hidden";
    });
    expect(equipmentBtnVisible).toBe(false);

    // 6. Test Back Button
    await page.click("#btn-setup-back");
    
    // 7. Should be back in Equipment screen
    await page.waitForSelector("#screen-equipment");

    // Verify Equipment screen is visible and NOT empty (black screen check)
    const equipmentVisible = await page.evaluate(() => {
        const screen = document.getElementById("screen-equipment");
        if (!screen) return false;
        const style = window.getComputedStyle(screen);
        // It should have content
        const hasContent = screen.children.length > 0;
        return style.display === "flex" && hasContent;
    });
    expect(equipmentVisible).toBe(true);

    // Take screenshot for proof of back navigation
    await page.screenshot({
      path: "tests/e2e/__snapshots__/mission_setup_campaign_back_navigation.png",
    });
  });

  it("should show full configuration when entering from custom mission", async () => {
    await page.goto(E2E_URL);

    // 1. Click "Custom Mission"
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");

    // 2. We should be in Mission Setup
    await page.waitForSelector("#screen-mission-setup");

    // A. Check if the title is "Mission Configuration"
    const titleText = await page.evaluate(() => {
        const h1 = document.getElementById("mission-setup-title");
        return h1 ? h1.textContent : "not found";
    });
    expect(titleText).toBe("Mission Configuration");

    // B. Check if map-config-section is visible
    const configVisible = await page.evaluate(() => {
        const section = document.getElementById("map-config-section");
        if (!section) return false;
        const style = window.getComputedStyle(section);
        return style.display !== "none" && style.visibility !== "hidden";
    });
    expect(configVisible).toBe(true);

    // C. Check if "Equipment & Supplies" button is visible
    const equipmentBtnVisible = await page.evaluate(() => {
        const btn = document.getElementById("btn-goto-equipment");
        if (!btn) return false;
        const style = window.getComputedStyle(btn);
        return style.display !== "none" && style.visibility !== "hidden";
    });
    expect(equipmentBtnVisible).toBe(true);

    // Take screenshot for proof of custom mode
    await page.screenshot({
      path: "tests/e2e/__snapshots__/mission_setup_custom_visibility.png",
    });
  });
});
