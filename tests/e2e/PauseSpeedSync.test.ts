import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Pause and Speed Synchronization E2E", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should hide speed and threat UI during deployment", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector("#screen-main-menu.title-splash-complete", { timeout: 10000 });

    // Go to Custom Mission
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");

    // 2. Click Launch Mission (goes to Deployment)
    await page.waitForSelector("#btn-launch-mission", { visible: true });
    await new Promise(r => setTimeout(r, 500)); // wait for transitions
    await page.click("#btn-launch-mission");

    // 3. Verify in Deployment phase
    await page.waitForSelector(".deployment-summary", { visible: true });

    // 4. Check visibility of speed control and threat container
    const speedControlVisible = await page.evaluate(() => {
      const el = document.getElementById("speed-control");
      return el && window.getComputedStyle(el).visibility !== "hidden" && window.getComputedStyle(el).display !== "none";
    });
    expect(speedControlVisible).toBe(false);

    const threatContainerVisible = await page.evaluate(() => {
      const el = document.getElementById("top-threat-container");
      return el && window.getComputedStyle(el).visibility !== "hidden" && window.getComputedStyle(el).display !== "none";
    });
    expect(threatContainerVisible).toBe(false);
    
    // Take screenshot for verification
    await page.screenshot({ path: "screenshots/pause_speed_sync_deployment.png" });
  });

  it("should show speed and pause UI after deployment starts", async () => {
    // 1. Click Auto-Fill Spawns
    await page.waitForSelector("#btn-autofill-deployment", { visible: true });
    await page.click("#btn-autofill-deployment");

    // 2. Click Start Mission
    await page.waitForSelector("#btn-start-mission:not(.disabled)", { visible: true });
    await page.click("#btn-start-mission");

    // 3. Verify mission starts
    await page.waitForSelector("#game-canvas", { visible: true });
    await new Promise(r => setTimeout(r, 500)); // wait for settling

    // 4. Check visibility of speed control
    const speedControlVisible = await page.evaluate(() => {
      const el = document.getElementById("speed-control");
      return el && window.getComputedStyle(el).visibility === "visible";
    });
    expect(speedControlVisible).toBe(true);
    
    // 5. Test slider logarithmic mapping
    await page.evaluate(() => {
        const slider = document.getElementById("game-speed") as HTMLInputElement;
        slider.value = "75";
        slider.dispatchEvent(new Event("input"));
    });
    
    await new Promise(r => setTimeout(r, 200)); // wait for sync
    
    // We can't easily check GameClient's internal timeScale from here 
    // without exposing it, but we can check the speed-value label
    const speedLabel = await page.evaluate(() => {
        return document.getElementById("speed-value")?.textContent;
    });
    // 75 on logarithmic scale is approx 3.16x
    expect(speedLabel).toContain("3.2x"); // fixed(1) of 3.16 is 3.2
    
    // Take screenshot
    await page.screenshot({ path: "screenshots/pause_speed_sync_playing.png" });
  });

  it("should work correctly on mobile viewport", async () => {
    await page.setViewport({ width: 400, height: 800 });
    await page.goto(E2E_URL);
    await page.reload();

    // 1. Start mission
    await page.waitForSelector("#btn-menu-custom", { visible: true });
    await page.click("#btn-menu-custom");
    await page.waitForSelector("#btn-launch-mission", { visible: true });
    await page.click("#btn-launch-mission");
    await page.waitForSelector("#btn-autofill-deployment", { visible: true });
    await page.click("#btn-autofill-deployment");
    await page.waitForSelector("#btn-start-mission:not(.disabled)", { visible: true });
    await page.click("#btn-start-mission");

    // 2. Open Objectives/Intel drawer (Right)
    await page.waitForSelector("#btn-toggle-right", { visible: true });
    await page.click("#btn-toggle-right");
    await new Promise(r => setTimeout(r, 500)); // wait for animation

    // 3. Verify mission controls (speed slider) are visible in the drawer/panel
    const mobileSpeedSliderVisible = await page.evaluate(() => {
      const el = document.querySelector(".mobile-speed-slider");
      return el && window.getComputedStyle(el).display !== "none";
    });
    expect(mobileSpeedSliderVisible).toBe(true);

    // Take mobile screenshot
    await page.screenshot({ path: "screenshots/pause_speed_sync_mobile.png" });
  });
});
