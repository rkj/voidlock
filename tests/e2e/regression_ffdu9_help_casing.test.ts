import puppeteer, { Browser, Page } from "puppeteer";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { E2E_URL } from "./config";

describe("Keyboard Help Casing Repro (voidlock-ffdu9)", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await browser.close();
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
