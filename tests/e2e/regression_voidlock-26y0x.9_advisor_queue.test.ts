import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Advisor Queue Regression (voidlock-26y0x.9)", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should queue blocking advisor messages instead of stacking them", async () => {
    await page.goto(E2E_URL);
    await page.waitForSelector("#screen-main-menu.title-splash-complete", { timeout: 10000 });

    // Inject 3 blocking messages in rapid succession
    await page.evaluate(() => {
      const overlay = (window as any).GameAppInstance.AdvisorOverlay;
      overlay.showMessage({
        id: "msg1",
        title: "Message 1",
        text: "First blocking message",
        blocking: true
      });
      overlay.showMessage({
        id: "msg2",
        title: "Message 2",
        text: "Second blocking message",
        blocking: true
      });
      overlay.showMessage({
        id: "msg3",
        title: "Message 3",
        text: "Third blocking message",
        blocking: true
      });
    });

    // 1. Asserts that only ONE .advisor-modal-backdrop element exists in the DOM at any time
    let backdrops = await page.$$(".advisor-modal-backdrop");
    expect(backdrops.length).toBe(1);

    // Verify the first message is displayed
    let title = await page.$eval(".advisor-title", el => el.textContent);
    expect(title).toBe("Message 1");

    // Also verify: at no point are there two elements with class 'advisor-btn' visible simultaneously
    let btns = await page.$$(".advisor-btn[data-id='dismiss']");
    expect(btns.length).toBe(1);

    // 2. Dismiss the dialog and assert the queued message appears next
    await page.click(".advisor-btn[data-id='dismiss']");
    
    // Wait a brief moment for the queue to process and the next render
    await new Promise(r => setTimeout(r, 100));

    // Verify second message
    backdrops = await page.$$(".advisor-modal-backdrop");
    expect(backdrops.length).toBe(1);
    
    title = await page.$eval(".advisor-title", el => el.textContent);
    expect(title).toBe("Message 2");

    btns = await page.$$(".advisor-btn[data-id='dismiss']");
    expect(btns.length).toBe(1);

    // 3. Dismiss second, verify third
    await page.click(".advisor-btn[data-id='dismiss']");
    await new Promise(r => setTimeout(r, 100));

    backdrops = await page.$$(".advisor-modal-backdrop");
    expect(backdrops.length).toBe(1);
    
    title = await page.$eval(".advisor-title", el => el.textContent);
    expect(title).toBe("Message 3");

    btns = await page.$$(".advisor-btn[data-id='dismiss']");
    expect(btns.length).toBe(1);

    // 4. Dismiss third, verify no more messages
    await page.click(".advisor-btn[data-id='dismiss']");
    await new Promise(r => setTimeout(r, 100));

    backdrops = await page.$$(".advisor-modal-backdrop");
    expect(backdrops.length).toBe(0);
  });
});
