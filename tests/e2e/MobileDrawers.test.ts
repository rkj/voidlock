import { describe, it, expect, beforeAll, afterAll } from "vitest";
import puppeteer, { Browser, Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Mobile Drawers", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    page = await browser.newPage();
    // Set mobile viewport
    await page.setViewport({ width: 375, height: 667, isMobile: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  it("should show drawer toggles and hide panels by default on mobile", async () => {
    await page.goto(`${E2E_URL}/#main-menu`);
    
    // Go to a custom mission to see the HUD
    await page.click("#btn-menu-custom");
    await page.waitForSelector("#btn-goto-equipment");
    await page.click("#btn-goto-equipment");
    
    // Wait for the Confirm Squad button in Equipment Screen
    await page.waitForSelector("[data-focus-id='btn-confirm-squad']");
    await page.click("[data-focus-id='btn-confirm-squad']");
    
    // Launch mission (Transition to Playing)
    await page.waitForSelector("#screen-mission", { visible: true });
    await new Promise(r => setTimeout(r, 1000)); // Wait for game to initialize

    // Check if toggles are visible
    const squadToggle = await page.$("#btn-toggle-squad");
    const objToggle = await page.$("#btn-toggle-right");
    
    expect(await squadToggle?.boundingBox()).not.toBeNull();
    expect(await objToggle?.boundingBox()).not.toBeNull();

    // Check if panels are collapsed (off-screen)
    const squadPanel = await page.$("#soldier-panel");
    const rightPanel = await page.$("#right-panel");

    const squadBox = await squadPanel?.boundingBox();
    const rightBox = await rightPanel?.boundingBox();

    // On mobile, they should be transform: translateX(-100%) and translateX(100%)
    // But boundingBox returns relative to viewport.
    // So squadPanel should be at x < 0 and rightPanel should be at x >= 375.
    
    expect(squadBox?.x).toBeLessThan(0);
    expect(rightBox?.x).toBeGreaterThanOrEqual(375);
  });

  it("should toggle Squad drawer", async () => {
    await page.click("#btn-toggle-squad");
    await new Promise(r => setTimeout(r, 400)); // Wait for transition

    const squadPanel = await page.$("#soldier-panel");
    const squadBox = await squadPanel?.boundingBox();
    expect(squadBox?.x).toBe(0);

    // Toggle off
    await page.click("#btn-toggle-squad");
    await new Promise(r => setTimeout(r, 400)); // Wait for transition
    const squadBoxOff = await squadPanel?.boundingBox();
    expect(squadBoxOff?.x).toBeLessThan(0);
  });

  it("should toggle Objectives drawer", async () => {
    await page.click("#btn-toggle-right");
    await new Promise(r => setTimeout(r, 400)); // Wait for transition

    const rightPanel = await page.$("#right-panel");
    const rightBox = await rightPanel?.boundingBox();
    console.log("Right Panel Bounding Box:", rightBox);
    // On mobile, it should be visible
    expect(rightBox?.x).toBeLessThan(375);
    expect(rightBox?.x).toBeGreaterThan(0);

    // Toggle off
    await page.click("#btn-toggle-right");
    await new Promise(r => setTimeout(r, 400)); // Wait for transition
    const rightBoxOff = await rightPanel?.boundingBox();
    expect(rightBoxOff?.x).toBeGreaterThanOrEqual(375);
  });

  it("should close one drawer when opening another", async () => {
    await page.click("#btn-toggle-squad");
    await new Promise(r => setTimeout(r, 400));
    
    await page.click("#btn-toggle-right");
    await new Promise(r => setTimeout(r, 400));

    const squadPanel = await page.$("#soldier-panel");
    const squadBox = await squadPanel?.boundingBox();
    expect(squadBox?.x).toBeLessThan(0);

    const rightPanel = await page.$("#right-panel");
    const rightBox = await rightPanel?.boundingBox();
    expect(rightBox?.x).toBeLessThan(375);
    expect(rightBox?.x).toBeGreaterThan(0);
  });

  it("should close drawers when clicking game area", async () => {
    await page.click("#btn-toggle-right");
    await new Promise(r => setTimeout(r, 400));
    
    // Click game container (center)
    await page.mouse.click(187, 333);
    await new Promise(r => setTimeout(r, 400));

    const rightPanel = await page.$("#right-panel");
    const rightBox = await rightPanel?.boundingBox();
    expect(rightBox?.x).toBeGreaterThanOrEqual(375);
  });

  it("should be able to change speed via mobile mission controls", async () => {
    // Open Objectives drawer
    await page.click("#btn-toggle-right");
    await new Promise(r => setTimeout(r, 400));

    // Check if Mission Controls is visible
    const missionControls = await page.$(".mission-controls");
    expect(missionControls).not.toBeNull();

    // Get initial speed value
    const speedValue = await page.$eval("#speed-value", el => el.textContent);
    
    // Change speed via mobile slider
    // We need to use page.evaluate or find the slider
    const slider = await page.$(".mobile-speed-slider");
    const sliderBox = await slider?.boundingBox();
    if (sliderBox) {
      // Drag slider to the right (e.g. to 100)
      await page.mouse.move(sliderBox.x + 2, sliderBox.y + sliderBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(sliderBox.x + sliderBox.width - 2, sliderBox.y + sliderBox.height / 2);
      await page.mouse.up();
    }

    await new Promise(r => setTimeout(r, 400));
    
    // Check if speed value changed (might need to check the mobile speed value display)
    const mobileSpeedValue = await page.$eval(".mobile-speed-value", el => el.textContent);
    expect(mobileSpeedValue).not.toBe(speedValue);
  });

  it("should be able to abort mission via mobile controls", async () => {
    // Ensure Objectives drawer is open
    const isActive = await page.evaluate(() => document.getElementById("right-panel")?.classList.contains("active"));
    if (!isActive) {
      await page.click("#btn-toggle-right");
      await new Promise(r => setTimeout(r, 600));
    }

    // Click Abort Mission button
    await page.click(".mobile-abort-button");
    
    // Wait for Custom Modal
    await page.waitForSelector(".modal-window", { visible: true });
    
    // Click OK (Primary Button)
    const okBtn = await page.waitForSelector(".modal-window .primary-button");
    await okBtn?.click();
    
    // Should navigate to Debrief screen
    await page.waitForSelector("#screen-debrief", { visible: true });
    expect(page.url()).toContain("debrief");
  });

  it("should not have Top Bar overflow on mobile", async () => {
    const topBar = await page.$("#top-bar");
    const topBarBox = await topBar?.boundingBox();
    expect(topBarBox?.width).toBe(375);

    // Check if children fit within the top bar
    const children = await page.$$("#top-bar > *");
    for (const child of children) {
      const box = await child.boundingBox();
      if (box && (await child.evaluate(el => getComputedStyle(el).display !== 'none'))) {
        // Should be within viewport width
        expect(box.x + box.width).toBeLessThanOrEqual(375.5); // Allow small subpixel diff
      }
    }
  });
});
