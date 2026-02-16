import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("voidlock-n34wo: Focus stay when buying equipment", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  async function startCampaignAndInjectScrap() {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.goto(E2E_URL);
    
    // Start Campaign
    await page.waitForSelector("#btn-menu-campaign");
    await page.click("#btn-menu-campaign");
    await page.waitForSelector(".campaign-setup-wizard");
    
    // Select Standard difficulty (starts with 300 scrap, but let's be sure)
    await page.evaluate(() => {
        const cards = document.querySelectorAll(".difficulty-card") as NodeListOf<HTMLElement>;
        for (const card of cards) {
            if (card.textContent?.includes("Standard")) {
                card.click();
                break;
            }
        }
    });

    const startBtn = await page.waitForSelector('[data-focus-id="btn-start-campaign"]');
    await startBtn?.click();
    
    await page.waitForSelector("#screen-campaign");
    
    // Inject 1000 scrap
    await page.evaluate(() => {
        const storageKey = "voidlock_campaign_v1";
        const data = localStorage.getItem(storageKey);
        if (data) {
            const state = JSON.parse(data);
            state.scrap = 1000;
            localStorage.setItem(storageKey, JSON.stringify(state));
        }
    });
    
    // Reload to ensure state is picked up
    await page.reload();
    await page.waitForSelector("#screen-campaign");
  }

  it("should keep focus on armory item after buying it in Campaign Mode", async () => {
    await startCampaignAndInjectScrap();
    
    // Click on the first node
    await page.waitForSelector(".campaign-node");
    await page.click(".campaign-node");
    
    await page.waitForSelector("#screen-equipment");

    // Select second soldier (Medic) - usually has Pistol/Knife
    await page.waitForSelector('[data-focus-id="soldier-slot-1"]');
    await page.click('[data-focus-id="soldier-slot-1"]');

    // Find a weapon that is NOT owned. 
    // Shotgun (cost 25) should not be owned by Medic.
    const weaponId = "armory-item-shotgun";
    const selector = `[data-focus-id="${weaponId}"]`;
    await page.waitForSelector(selector);
    
    // Verify it says something with "Scrap" or "CR" (not Owned)
    const priceText = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        const priceEl = el?.querySelector(".price-cost");
        return priceEl?.textContent || el?.textContent || "";
    }, selector);
    
    console.log("Price text before buy:", priceText);
    expect(priceText).toMatch(/Scrap|CR|25/);

    // Focus it
    await page.evaluate((sel) => {
        (document.querySelector(sel) as HTMLElement).focus();
    }, selector);
    
    // Verify focus
    const isFocusedBefore = await page.evaluate((sel) => {
        return document.activeElement === document.querySelector(sel);
    }, selector);
    expect(isFocusedBefore).toBe(true);
    
    // Take screenshot before
    await page.screenshot({ path: "screenshots/n34wo_before_buy.png" });

    // Buy it
    await page.keyboard.press("Enter");
    
    // Wait for render
    await new Promise(r => setTimeout(r, 500));
    
    // Check if Owned now
    const priceTextAfter = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el?.querySelector(".price-owned")?.textContent || "";
    }, selector);
    console.log("Price text after buy:", priceTextAfter);
    expect(priceTextAfter).toBe("Owned");

    // Verify focus still on it
    const isFocusedAfter = await page.evaluate((sel) => {
        return document.activeElement === document.querySelector(sel);
    }, selector);
    
    const activeInfo = await page.evaluate(() => {
        const el = document.activeElement;
        return {
            tagName: el?.tagName,
            focusId: el?.getAttribute("data-focus-id"),
            text: el?.textContent?.substring(0, 50)
        };
    });
    console.log("Active element after buy:", activeInfo);

    // Take screenshot after
    await page.screenshot({ path: "screenshots/n34wo_after_buy.png" });

    expect(isFocusedAfter).toBe(true);
  }, 60000);

  it("should keep focus on supply plus button after buying a grenade", async () => {
    await startCampaignAndInjectScrap();
    
    // Click on the first node
    await page.waitForSelector(".campaign-node");
    await page.click(".campaign-node");
    
    await page.waitForSelector("#screen-equipment");

    // Select first soldier
    await page.waitForSelector('[data-focus-id="soldier-slot-0"]');
    await page.click('[data-focus-id="soldier-slot-0"]');

    // Find Landmine plus button
    const plusBtnId = "supply-plus-mine";
    const selector = `[data-focus-id="${plusBtnId}"]`;
    await page.waitForSelector(selector);
    
    // Scroll it into view
    await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement;
        el.scrollIntoView();
    }, selector);

    // Focus it
    await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement;
        el.focus();
    }, selector);
    
    // Verify focus
    const focusState = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        const active = document.activeElement;
        return {
            isMatch: active === el,
            activeTag: active?.tagName,
            activeId: active?.id,
            activeFocusId: active?.getAttribute("data-focus-id"),
            targetFocusId: el?.getAttribute("data-focus-id"),
            targetVisible: !!(el as HTMLElement).offsetParent,
            targetDisabled: (el as HTMLButtonElement).disabled
        };
    }, selector);
    console.log("Plus button focus state before:", focusState);
    expect(focusState.isMatch).toBe(true);
    
    // Buy one
    await page.keyboard.press("Enter");
    
    // Wait for render
    await new Promise(r => setTimeout(r, 500));
    
    // Verify focus still on it
    const isFocusedAfter = await page.evaluate((sel) => {
        return document.activeElement === document.querySelector(sel);
    }, selector);
    
    const activeInfo = await page.evaluate(() => {
        const el = document.activeElement;
        return {
            tagName: el?.tagName,
            focusId: el?.getAttribute("data-focus-id"),
            disabled: (el as HTMLButtonElement)?.disabled
        };
    });
    console.log("Active element after plus:", activeInfo);

    expect(isFocusedAfter).toBe(true);
  }, 60000);
});
