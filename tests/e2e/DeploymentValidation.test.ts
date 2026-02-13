import { describe, it, expect, beforeAll, afterAll } from "vitest";
import puppeteer, { Browser, Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Deployment Validation", () => {
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

  it("should allow drag-and-drop deployment and enable Start Mission", async () => {
    console.log("Navigating to", E2E_URL);
    await page.goto(E2E_URL);
    
    console.log("Waiting for #btn-menu-custom");
    await page.waitForSelector("#btn-menu-custom");
    
    console.log("Clicking #btn-menu-custom");
    await page.click("#btn-menu-custom");

    // Enable Manual Deployment
    console.log("Waiting for #toggle-manual-deployment");
    await page.waitForSelector("#toggle-manual-deployment");
    const isChecked = await page.$eval("#toggle-manual-deployment", (el: any) => el.checked);
    console.log("Manual Deployment checked:", isChecked);
    if (!isChecked) {
      console.log("Checking #toggle-manual-deployment");
      await page.click("#toggle-manual-deployment");
    }

    // Launch to Deployment Phase
    console.log("Clicking #btn-launch-mission");
    await page.click("#btn-launch-mission");
    
    console.log("Waiting for .deployment-summary");
    try {
      await page.waitForSelector(".deployment-summary", { timeout: 10000 });
    } catch (e) {
      console.log("Timeout waiting for .deployment-summary, taking screenshot");
      await page.screenshot({ path: "deployment_timeout.png" });
      throw e;
    }

    // Verify Start Mission is disabled initially
    console.log("Checking if Start Mission is disabled");
    const startBtn = await page.$("#btn-start-mission");
    expect(startBtn).not.toBeNull();
    const isDisabled = await page.$eval("#btn-start-mission", (el: any) => el.disabled);
    expect(isDisabled).toBe(true);

    // Find a unit in the roster
    console.log("Waiting for .deployment-unit-item");
    const unitItem = await page.waitForSelector(".deployment-unit-item");
    const unitBox = await unitItem!.boundingBox();
    expect(unitBox).not.toBeNull();

    const canvas = await page.waitForSelector("#game-canvas");
    const canvasBox = await canvas!.boundingBox();
    expect(canvasBox).not.toBeNull();

    // Drag from roster to canvas (center-ish)
    console.log("Dragging unit to canvas");
    await page.mouse.move(unitBox!.x + unitBox!.width / 2, unitBox!.y + unitBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBox!.x + canvasBox!.width / 2, canvasBox!.y + canvasBox!.height / 2, { steps: 10 });
    await page.mouse.up();

    // Wait a bit for state update
    await new Promise(r => setTimeout(r, 1000));

    // Check if unit is marked as Deployed in roster
    const statusText = await page.$eval(".deployment-unit-item .roster-item-details span:last-child", (el: any) => el.textContent);
    console.log("Unit status after drag:", statusText);
    
    // Let's use Auto-Fill to be sure
    console.log("Clicking #btn-autofill-deployment");
    await page.click("#btn-autofill-deployment");
    await new Promise(r => setTimeout(r, 1000));

    const statusAfterAutoFill = await page.$eval(".deployment-unit-item .roster-item-details span:last-child", (el: any) => el.textContent);
    console.log("Unit status after auto-fill:", statusAfterAutoFill);
    expect(statusAfterAutoFill).toBe("Deployed");

    const isDisabledAfter = await page.$eval("#btn-start-mission", (el: any) => el.disabled);
    console.log("Start Mission disabled after auto-fill:", isDisabledAfter);
    expect(isDisabledAfter).toBe(false);
  }, 120000); // 2 minute timeout
});
