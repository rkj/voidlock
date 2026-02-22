import { describe, it, expect, beforeAll, afterAll } from "vitest";
import puppeteer, { Browser, Page } from "puppeteer";
import { E2E_PORT } from "./config";

describe("AdvisorOverlay E2E", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768 });
    await page.goto(`http://localhost:${E2E_PORT}/`, { waitUntil: "networkidle0" });
  });

  afterAll(async () => {
    await browser.close();
  });

  it("should show advisor messages when triggered", async () => {
    // We can use page.evaluate to access GameApp and trigger the tutorialManager
    await page.evaluate(() => {
        const app = (window as any).GameAppInstance;
        if (app && app.AdvisorOverlay) {
            app.AdvisorOverlay.showMessage({
                id: "test_msg",
                text: "THIS IS A TEST MESSAGE FROM THE ADVISOR.",
                blocking: false,
                duration: 5000
            });
        }
    });

    // Check if the message is visible
    const messageExists = await page.waitForSelector(".advisor-message", { timeout: 2000 });
    expect(messageExists).not.toBeNull();

    const text = await page.$eval(".advisor-text", el => el.textContent);
    expect(text).toBe("THIS IS A TEST MESSAGE FROM THE ADVISOR.");

    // Check for portrait
    const portraitExists = await page.$(".advisor-portrait img");
    expect(portraitExists).not.toBeNull();
  });

  it("should handle blocking messages with a continue button", async () => {
    await page.evaluate(() => {
        const app = (window as any).GameAppInstance;
        if (app && app.AdvisorOverlay) {
            app.AdvisorOverlay.showMessage({
                id: "blocking_test",
                text: "THIS IS A BLOCKING MESSAGE.",
                blocking: true
            });
        }
    });

    // Check for backdrop
    const backdropExists = await page.waitForSelector(".advisor-modal-backdrop", { timeout: 2000 });
    expect(backdropExists).not.toBeNull();

    // Check for button
    const btnExists = await page.$(".advisor-btn");
    expect(btnExists).not.toBeNull();
    const btnText = await page.$eval(".advisor-btn", el => el.textContent);
    expect(btnText).toBe("Continue");

    // Take screenshot at 1024x768
    await page.screenshot({ path: "screenshots/advisor_blocking_1024x768.png" });

    // Click continue
    await page.click(".advisor-btn");

    // Backdrop should be gone
    await page.waitForSelector(".advisor-modal-backdrop", { hidden: true, timeout: 2000 });
  });

  it("should look good on mobile viewports", async () => {
    await page.setViewport({ width: 400, height: 800 });
    await page.evaluate(() => {
        const app = (window as any).GameAppInstance;
        if (app && app.AdvisorOverlay) {
            app.AdvisorOverlay.showMessage({
                id: "mobile_test",
                text: "ADVISOR MESSAGE ON MOBILE VIEWPORT. ENSURE IT FITS.",
                blocking: true
            });
        }
    });

    const backdropExists = await page.waitForSelector(".advisor-modal-backdrop", { timeout: 2000 });
    expect(backdropExists).not.toBeNull();

    // Take screenshot at 400x800
    await page.screenshot({ path: "screenshots/advisor_blocking_400x800.png" });

    // Click continue
    await page.click(".advisor-btn");
    await page.waitForSelector(".advisor-modal-backdrop", { hidden: true, timeout: 2000 });
  });
});
