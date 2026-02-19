import { describe, it, expect, afterAll, beforeAll, beforeEach } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Equipment Purchase Focus Management", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
  });

  afterAll(async () => {
    await closeBrowser();
  });

  async function startCampaign() {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.goto(E2E_URL);
    await page.waitForSelector("#btn-menu-campaign");
    await page.click("#btn-menu-campaign");
    
    // New Campaign Wizard should appear
    await page.waitForSelector(".campaign-setup-wizard");
    
    // Click Start Campaign
    const startBtn = await page.waitForSelector('[data-focus-id="btn-start-campaign"]');
    await startBtn?.click();
    
    // Wait for Campaign Screen
    await page.waitForSelector("#screen-campaign");
  }

  beforeEach(async () => {
    await startCampaign();
  });

  it("should keep focus on the armory item after purchasing it via keyboard", async () => {
    // Click on the first node to start a mission setup (goes straight to Equipment in campaign)
    await page.waitForSelector(".campaign-node");
    await page.click(".campaign-node");
    
    await page.waitForSelector("#screen-equipment");

    // Select the first soldier
    await page.click('[data-focus-id="soldier-slot-0"]');
    
    // Find Shotgun in Armory
    const shotgunSelector = '.armory-panel .armory-item';
    await page.waitForSelector(shotgunSelector);
    
    const items = await page.$$(shotgunSelector);
    let shotgunIndex = -1;
    for (let i = 0; i < items.length; i++) {
        const text = await page.evaluate(el => el.textContent, items[i]);
        if (text?.includes("Shotgun")) {
            shotgunIndex = i;
            break;
        }
    }
    
    expect(shotgunIndex).not.toBe(-1);
    
    // Focus it
    await page.evaluate((index) => {
        const items = document.querySelectorAll('.armory-panel .armory-item') as NodeListOf<HTMLElement>;
        items[index].focus();
    }, shotgunIndex);
    
    // Verify it is focused
    let isFocused = await page.evaluate((index) => {
        const items = document.querySelectorAll('.armory-panel .armory-item') as NodeListOf<HTMLElement>;
        return document.activeElement === items[index];
    }, shotgunIndex);
    expect(isFocused).toBe(true);
    
    // Press Enter to "buy"/equip it
    await page.keyboard.press("Enter");
    
    // Wait for re-render
    await new Promise(r => setTimeout(r, 500));
    
    // Check if it is still focused
    isFocused = await page.evaluate((index) => {
        const items = document.querySelectorAll('.armory-panel .armory-item') as NodeListOf<HTMLElement>;
        return document.activeElement === items[index];
    }, shotgunIndex);
    
    expect(isFocused).toBe(true);
    
    // Take screenshot
    await page.screenshot({ path: "screenshots/equipment_purchased_focus.png" });
  });

  it("should keep focus on the plus button after adding a supply item via keyboard", async () => {
    // Click on the first node to start a mission setup (goes straight to Equipment in campaign)
    await page.waitForSelector(".campaign-node");
    await page.click(".campaign-node");
    
    await page.waitForSelector("#screen-equipment");

    // Select the first soldier
    await page.click('[data-focus-id="soldier-slot-0"]');

    // Scroll to Global Supplies
    await page.evaluate(() => {
        const rightPanel = document.querySelector('.armory-panel .scroll-content');
        if (rightPanel) rightPanel.scrollTop = 1000; // Scroll to bottom
    });
    
    // Find Mine plus button (starts at 0, so should be enabled)
    const plusBtnSelector = '[data-focus-id="supply-plus-mine"]';
    await page.waitForSelector(plusBtnSelector);
    
    // Focus it
    await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement;
        el.scrollIntoView();
        el.focus();
    }, plusBtnSelector);

    // Verify it IS focused before pressing Enter
    const beforeFocus = await page.evaluate((sel) => {
        return document.activeElement === document.querySelector(sel);
    }, plusBtnSelector);
    console.log("Focused before Enter:", beforeFocus);
    
    // Press Enter
    await page.keyboard.press("Enter");
    
    // Wait for re-render
    await new Promise(r => setTimeout(r, 1000));
    
    // Check if it is still focused
    const result = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        const active = document.activeElement;
        const count = el?.parentElement?.querySelector('span')?.textContent;
        return {
            isFocused: active === el,
            activeFocusId: active?.getAttribute("data-focus-id"),
            activeTag: active?.tagName,
            buttonExists: !!el,
            buttonDisabled: (el as HTMLButtonElement)?.disabled,
            count: count
        };
    }, plusBtnSelector);
    
    console.log("Focus check result:", result);
    
    if (result.buttonDisabled) {
        // If the plus button is disabled (max reached), focus should fallback to minus button
        const minusSelector = plusBtnSelector.replace("plus", "minus");
        const minusFocused = await page.evaluate((sel) => {
            return document.activeElement === document.querySelector(sel);
        }, minusSelector);
        expect(minusFocused, "Focus should fallback to minus button if plus is disabled").toBe(true);
    } else {
        expect(result.isFocused).toBe(true);
    }
    
    // Take screenshot
    await page.screenshot({ path: "screenshots/supply_plus_focus.png" });
  });
});
