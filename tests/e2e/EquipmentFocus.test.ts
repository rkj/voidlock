import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Equipment Screen Focus Verification", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
  });

  afterAll(async () => {
    await closeBrowser();
  });

  async function navigateToEquipment() {
    try {
      console.log("Navigating to URL...");
      await page.goto(E2E_URL);
      await page.evaluate(() => localStorage.clear());
      await page.goto(E2E_URL);

      // Navigate to Campaign
      console.log("Waiting for Campaign button...");
      await page.waitForSelector("#btn-menu-campaign", {
        visible: true,
        timeout: 5000,
      });
      await page.click("#btn-menu-campaign");

      // New Campaign Wizard
      console.log("Waiting for Campaign Setup Wizard...");
      await page.waitForSelector(".campaign-setup-wizard", { visible: true, timeout: 5000 });
      await page.click("[data-focus-id='btn-start-campaign']"); // Start Campaign

      // Wait for Campaign Screen (Sector Map)
      console.log("Waiting for Campaign Screen...");
      await page.waitForSelector(".campaign-screen", { visible: true, timeout: 10000 });

      // Go to Barracks
      console.log("Waiting for Tab buttons...");
      await page.waitForSelector(".tab-button", { visible: true, timeout: 5000 });
      const navTabs = await page.$$(".tab-button");
      let foundBarracks = false;
      for (const tab of navTabs) {
        const text = await page.evaluate(el => el.textContent, tab);
        console.log("Found tab:", text);
        if (text?.includes("Barracks")) {
          await tab.click();
          foundBarracks = true;
          break;
        }
      }
      if (!foundBarracks) throw new Error("Barracks tab not found");

      // In Barracks, click first soldier and then Armory tab
      console.log("Waiting for Soldier Item...");
      await page.waitForSelector(".soldier-item", { visible: true, timeout: 10000 });
      await page.click(".soldier-item"); // Select first soldier
      
      console.log("Waiting for Inspector details...");
      await page.waitForSelector(".inspector-details-content", { visible: true, timeout: 5000 });

      // Click Armory tab
      console.log("Waiting for Armory sidebar tab...");
      const sidebarTabs = await page.$$("button");
      let foundArmory = false;
      for (const tab of sidebarTabs) {
        const text = await page.evaluate(el => el.textContent, tab);
        console.log("Found button in sidebar:", text);
        if (text?.includes("Armory")) {
          await tab.click();
          foundArmory = true;
          break;
        }
      }
      if (!foundArmory) throw new Error("Armory tab not found in sidebar");

      console.log("Waiting for Armory items...");
      await page.waitForSelector("[data-focus-id^='armory-item-']", { visible: true, timeout: 5000 });
      console.log("Navigation successful");
    } catch (e) {
      console.error("Navigation Error:", e.message);
      await page.screenshot({
        path: `tests/e2e/__snapshots__/focus_nav_error_${Date.now()}.png`,
      });
      throw e;
    }
  }

  it("should keep focus on armory item after equipping with Enter", async () => {
    await page.setViewport({ width: 1280, height: 720 });
    await navigateToEquipment();

    // 1. Find an item in the armory that is not already equipped
    // Pulse Rifle is usually not equipped by default for the first soldier (Scout has Pistol/Knife)
    const pulseRifleSelector = "[data-focus-id='armory-item-pulse_rifle']";
    await page.waitForSelector(pulseRifleSelector);
    
    // Focus the item
    await page.evaluate((selector) => {
      const el = document.querySelector(selector) as HTMLElement;
      if (el) el.focus();
    }, pulseRifleSelector);

    // Verify it is focused
    const isInitiallyFocused = await page.evaluate((selector) => {
      return document.activeElement === document.querySelector(selector);
    }, pulseRifleSelector);
    expect(isInitiallyFocused).toBe(true);

    // 2. Press Enter to equip
    console.log("Pressing Enter to equip...");
    await page.keyboard.press("Enter");

    // Wait a bit for re-render
    await new Promise((r) => setTimeout(r, 500));

    // 3. Verify focus is still on the same item (or its new instance with same ID)
    const activeInfo = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement;
      return {
        tagName: active?.tagName,
        id: active?.id,
        className: active?.className,
        focusId: active?.getAttribute("data-focus-id"),
      };
    });
    console.log("Focused element after equip:", activeInfo);

    const isStillFocused = activeInfo.focusId === "armory-item-pulse_rifle";

    expect(isStillFocused).toBe(true);
  });
});
