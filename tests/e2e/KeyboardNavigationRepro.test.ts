import puppeteer, { Browser, Page } from "puppeteer";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { E2E_URL } from "./config";

describe("Keyboard Navigation Differentiation", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768 });
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.goto(E2E_URL);
    await page.waitForSelector("#screen-main-menu", { visible: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  it("verifies that ArrowDown navigates while ArrowRight is ignored on vertical Main Menu", async () => {
    // 1. Ensure first button is focused
    await page.focus("#btn-menu-campaign");
    let activeId = await page.evaluate(() => document.activeElement?.id);
    expect(activeId).toBe("btn-menu-campaign");

    // 2. Test ArrowDown (Should navigate to Custom Mission)
    await page.keyboard.press("ArrowDown");
    activeId = await page.evaluate(() => document.activeElement?.id);
    expect(activeId).toBe("btn-menu-custom");

    // 3. Reset and Test ArrowRight (Should be ignored in vertical mode)
    await page.focus("#btn-menu-campaign");
    await page.keyboard.press("ArrowRight");
    activeId = await page.evaluate(() => document.activeElement?.id);
    expect(activeId).toBe("btn-menu-campaign"); // Stayed on campaign

    // 4. Reset and Test Tab (Should navigate to Custom Mission - standard behavior)
    await page.focus("#btn-menu-campaign");
    await page.keyboard.press("Tab");
    activeId = await page.evaluate(() => document.activeElement?.id);
    expect(activeId).toBe("btn-menu-custom");
  });

  it("verifies horizontal navigation for Shell Tabs", async () => {
    // 1. Navigate to Statistics Screen to see tabs
    await page.click("#btn-menu-statistics");
    await page.waitForSelector("#campaign-shell-top-bar", { visible: true });

    // 2. Focus first tab
    const tabSelector = ".shell-tab";
    await page.waitForSelector(tabSelector);
    
    // Find all tabs
    const tabsCount = await page.evaluate((sel) => document.querySelectorAll(sel).length, tabSelector);
    if (tabsCount > 1) {
      await page.evaluate((sel) => (document.querySelectorAll(sel)[0] as HTMLElement).focus(), tabSelector);
      
      const firstTabLabel = await page.evaluate((sel) => document.querySelectorAll(sel)[0].textContent, tabSelector);
      
      // 3. Test ArrowRight (Should navigate to next tab)
      await page.keyboard.press("ArrowRight");
      const activeText = await page.evaluate(() => document.activeElement?.textContent);
      expect(activeText).not.toBe(firstTabLabel);

      // 4. Test ArrowDown (Should NOT navigate tabs in horizontal mode)
      await page.evaluate((sel) => (document.querySelectorAll(sel)[0] as HTMLElement).focus(), tabSelector);
      await page.keyboard.press("ArrowDown");
      const stillActiveText = await page.evaluate(() => document.activeElement?.textContent);
      expect(stillActiveText).toBe(firstTabLabel);
    }
  });

  it("verifies geometric 2D navigation in New Campaign Wizard", async () => {
    // Go back to main menu
    await page.click(".campaign-top-bar .back-button"); // "Main Menu" button in shell
    await page.waitForSelector("#btn-menu-campaign", { visible: true });
    await page.click("#btn-menu-campaign");
    await page.waitForSelector(".campaign-setup-wizard", { visible: true });

    // Difficulty cards are horizontal. Tactical Pause toggle is below them.
    await page.evaluate(() => (document.querySelector(".difficulty-card") as HTMLElement).focus());
    const firstCardText = await page.evaluate(() => document.activeElement?.textContent);

    // ArrowRight should move to next card
    await page.keyboard.press("ArrowRight");
    const secondCardText = await page.evaluate(() => document.activeElement?.textContent);
    expect(secondCardText).not.toBe(firstCardText);

    // ArrowDown should move to the toggle/checkbox BELOW the cards
    await page.keyboard.press("ArrowDown");
    const activeTagName = await page.evaluate(() => document.activeElement?.tagName);
    
    // It should be either a checkbox or a select or another button below
    expect(["INPUT", "SELECT", "BUTTON"]).toContain(activeTagName);
  });
});
