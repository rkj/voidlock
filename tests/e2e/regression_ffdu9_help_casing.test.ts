import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Keyboard Help Casing Repro (voidlock-ffdu9)", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  test("Keyboard help title should be Title Case", async () => {
    await page.goto(E2E_URL, { waitUntil: "networkidle0" });
    
    // Press '?' to open help
    console.log("Opening Keyboard Help...");
    await page.keyboard.type("?");
    
    await page.waitForSelector(".help-overlay-window h2", { visible: true });
    const titleText = await page.$eval(".help-overlay-window h2", (el) => el.textContent);
    console.log(`Help Title: "${titleText}"`);
    
    expect(titleText).toBe("Keyboard Shortcuts");
    
    // Take screenshot
    await page.screenshot({ path: "screenshots/voidlock-ffdu9-keyboard-help-fixed.png" });
  });
});
