import { describe, it, expect, beforeEach, afterEach } from "vitest";
import puppeteer, { Browser, Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Soldier Name Truncation Verification", () => {
  let browser: Browser;
  let page: Page;

  beforeEach(async () => {
    browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
  });

  afterEach(async () => {
    await browser.close();
  });

  it("should ensure soldier names are NOT truncated in the roster sidebar", async () => {
    await page.goto(`${E2E_URL}/#screen-main-menu`, { waitUntil: "load" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "load" });

    // 1. Start Campaign
    await page.waitForSelector("#btn-menu-campaign", { visible: true });
    await page.click("#btn-menu-campaign");

    // 2. Initialize Expedition (skip prologue to get to Sector Map/Ready Room faster)
    await page.waitForSelector("#campaign-skip-prologue", { visible: true });
    await page.click("#campaign-skip-prologue");
    await page.click(".primary-button");

    // 3. We should be on Sector Map. Click 'Ready Room' (Asset Management Hub)
    const tabSelector = '.tab-button[data-id="ready-room"]';
    await page.waitForSelector(tabSelector, { visible: true });
    await page.click(tabSelector);

    // 4. Find a soldier name in the roster (left panel)
    // Roster item names are in .roster-item-header strong
    await page.waitForSelector(".roster-item-header strong", { visible: true });

    // 5. Inject a VERY long name to force truncation if logic is bugged
    await page.evaluate(() => {
        // Find the first soldier name and make it long
        const nameEl = document.querySelector(".roster-item-header strong");
        if (nameEl) {
            nameEl.textContent = "Roman 'The Great Overlord of the Voidlock Universe' Kamyk (1)";
        }
    });

    // 6. Check for truncation
    const truncationInfo = await page.evaluate(() => {
        const nameEl = document.querySelector(".roster-item-header strong") as HTMLElement;
        if (!nameEl) return null;
        
        return {
            scrollWidth: nameEl.scrollWidth,
            clientWidth: nameEl.clientWidth,
            textContent: nameEl.textContent,
            overflow: window.getComputedStyle(nameEl).overflow,
            textOverflow: window.getComputedStyle(nameEl).textOverflow,
            whiteSpace: window.getComputedStyle(nameEl).whiteSpace
        };
    });

    console.log("Truncation Info:", truncationInfo);

    // FAILURE CASE: If it has ellipsis or nowrap, it's likely truncating
    // We want it to NOT truncate, so we expect scrollWidth to be <= clientWidth 
    // OR we expect whiteSpace to NOT be nowrap.
    if (truncationInfo) {
        expect(truncationInfo.whiteSpace).not.toBe("nowrap");
        expect(truncationInfo.textOverflow).not.toBe("ellipsis");
    }
  }, 60000);
});
