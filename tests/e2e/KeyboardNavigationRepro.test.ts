import puppeteer, { Browser, Page } from "puppeteer";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { E2E_URL } from "./config";

describe("Keyboard Navigation Repro", () => {
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
    await page.waitForSelector("#screen-main-menu", { visible: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  it("verifies that ArrowDown, ArrowRight, and Tab perform identical navigation on Main Menu", async () => {
    // 1. Ensure first button is focused
    await page.focus("#btn-menu-campaign");
    let activeId = await page.evaluate(() => document.activeElement?.id);
    expect(activeId).toBe("btn-menu-campaign");

    // 2. Test ArrowDown
    await page.keyboard.press("ArrowDown");
    activeId = await page.evaluate(() => document.activeElement?.id);
    expect(activeId).toBe("btn-menu-custom");

    // 3. Reset and Test ArrowRight
    await page.focus("#btn-menu-campaign");
    await page.keyboard.press("ArrowRight");
    activeId = await page.evaluate(() => document.activeElement?.id);
    expect(activeId).toBe("btn-menu-custom");

    // 4. Reset and Test Tab
    await page.focus("#btn-menu-campaign");
    await page.keyboard.press("Tab");
    activeId = await page.evaluate(() => document.activeElement?.id);
    expect(activeId).toBe("btn-menu-custom");

    // 5. Test Backward Navigation (ArrowUp, ArrowLeft, Shift+Tab)
    await page.focus("#btn-menu-custom");
    
    await page.keyboard.press("ArrowUp");
    activeId = await page.evaluate(() => document.activeElement?.id);
    expect(activeId).toBe("btn-menu-campaign");

    await page.focus("#btn-menu-custom");
    await page.keyboard.press("ArrowLeft");
    activeId = await page.evaluate(() => document.activeElement?.id);
    expect(activeId).toBe("btn-menu-campaign");

    await page.focus("#btn-menu-custom");
    await page.keyboard.down("Shift");
    await page.keyboard.press("Tab");
    await page.keyboard.up("Shift");
    activeId = await page.evaluate(() => document.activeElement?.id);
    expect(activeId).toBe("btn-menu-campaign");
  });
});
