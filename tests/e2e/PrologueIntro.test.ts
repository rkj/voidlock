import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Prologue: Advisor Intro Illustration and Backstory", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1280, height: 800 });
    page.on("console", (msg) => console.log("BROWSER:", msg.text()));
  }, 30000);

  afterAll(async () => {
    await closeBrowser();
  });

  it("should show Advisor Intro modal before launching Prologue mission", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => {
        localStorage.clear();
        // Clear meta stats to ensure prologue is NOT skipped
        localStorage.removeItem("voidlock_meta_stats");
    });
    await page.reload();
    await page.waitForSelector("#btn-menu-campaign");

    // Wait for splash to finish (Spec 8.1 / MainMenuScreen.ts)
    console.log("Waiting for title splash to finish...");
    await page.waitForSelector("#screen-main-menu.title-splash-complete", { timeout: 5000 });

    // 1. Start New Campaign
    console.log("Starting New Campaign...");
    await page.waitForSelector("#btn-menu-campaign", { visible: true });
    await page.click("#btn-menu-campaign");
    
    // Wait for the campaign screen container to be visible
    await page.waitForSelector("#screen-campaign", { visible: true });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: "screenshots/after_campaign_click.png" });
    
    const startBtnSelector = ".campaign-setup-wizard .primary-button";
    await page.waitForSelector(startBtnSelector, { visible: true });

    // 2. Click Start Campaign
    console.log("Clicking Initialize Expedition...");
    await page.click(startBtnSelector);

    // 3. Should redirect to Equipment Screen (Ready Room)
    console.log("Waiting for Equipment Screen...");
    await page.waitForSelector(".equipment-screen", { visible: true });
    
    // 4. Check if Launch Mission button exists (ADR 0049)
    console.log("Checking for Launch Mission button...");
    await page.waitForSelector("[data-focus-id='btn-launch-mission']", { visible: true });

    // 5. Click Launch Mission
    console.log("Clicking Launch Mission...");
    await page.click("[data-focus-id='btn-launch-mission']");

    // 6. Should show Advisor Intro Modal
    console.log("Waiting for Advisor Intro Modal...");
    await page.waitForSelector(".advisor-narrative-modal", { visible: true });
    
    // 7. Verify modal content
    const title = await page.$eval(".advisor-title", el => el.textContent);
    expect(title).toBe("Project Voidlock: Operation First Light");
    
    const hasIllustration = await page.$eval(".advisor-illustration img", el => !!el.getAttribute("src"));
    expect(hasIllustration).toBe(true);

    // 8. Take screenshot of the modal
    console.log("Taking screenshot of Advisor Intro Modal...");
    const screenshotPath = "screenshots/prologue_intro_modal.png";
    await page.screenshot({ path: screenshotPath });
    console.log(`Screenshot saved to ${screenshotPath}`);

    // 9. Click Continue
    console.log("Clicking Continue in Modal...");
    await page.click(".advisor-btn");

    // 10. Should transition to Mission (Deployment Phase or Active)
    console.log("Waiting for Mission to start...");
    // It might go to Deployment Phase first if manual deployment is enabled by default in campaign?
    // Let's check for any mission-related UI
    await page.waitForSelector("#game-canvas", { visible: true });
    
    console.log("Mission started successfully.");
  }, 120000);

  it("should allow dismissing Advisor Intro modal with Enter key", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => {
        localStorage.clear();
        localStorage.removeItem("voidlock_meta_stats");
    });
    await page.reload();
    
    await page.waitForSelector("#screen-main-menu.title-splash-complete", { timeout: 5000 });
    await page.click("#btn-menu-campaign");
    
    const startBtnSelector = ".campaign-setup-wizard .primary-button";
    await page.waitForSelector(startBtnSelector, { visible: true });
    await page.click(startBtnSelector);

    await page.waitForSelector(".equipment-screen", { visible: true });
    await page.waitForSelector("[data-focus-id='btn-launch-mission']", { visible: true });
    await page.click("[data-focus-id='btn-launch-mission']");

    console.log("Waiting for Advisor Intro Modal...");
    await page.waitForSelector(".advisor-narrative-modal", { visible: true });

    console.log("Pressing Enter to dismiss modal...");
    await page.keyboard.press("Enter");

    console.log("Waiting for Mission to start...");
    await page.waitForSelector("#game-canvas", { visible: true });
    
    console.log("Mission started successfully via keyboard.");
  }, 120000);
});
