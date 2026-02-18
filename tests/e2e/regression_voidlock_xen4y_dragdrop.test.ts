import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("voidlock-xen4y Regression: Drag and drop during deployment", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
  }, 30000);

  afterAll(async () => {
    await closeBrowser();
  });

  it("should verify that native drag and drop is handled by preventing default on dragover", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 1. Enter Custom Mission
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");
    
    // Ensure Manual Deployment is ON
    const isChecked = await page.evaluate(() => {
        const el = document.getElementById("toggle-manual-deployment") as HTMLInputElement;
        return el.checked;
    });
    if (!isChecked) await page.click("#toggle-manual-deployment");

    // Launch
    await page.click("#btn-goto-equipment");
    await page.waitForSelector(".equipment-screen");
    await page.click("button.primary-button"); 
    
    await page.waitForSelector("#btn-launch-mission");
    await page.click("#btn-launch-mission");

    // Wait for Deployment Phase
    await page.waitForSelector(".deployment-summary");
    await page.waitForSelector("#game-canvas");

    // 2. Attempt Native Drag and Drop simulation
    const sourceSelector = ".deployment-unit-item";
    await page.waitForSelector(sourceSelector);

    const unitId = await page.$eval(sourceSelector, el => (el as HTMLElement).dataset.unitId);

    const dropSuccess = await page.evaluate(async (unitId) => {
        const source = document.querySelector(`.deployment-unit-item[data-unit-id="${unitId}"]`);
        const canvas = document.getElementById("game-canvas");
        if (!source || !canvas) return "Missing elements";

        const rect = canvas.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        // Simulate dragstart
        const dragStartEvent = new DragEvent('dragstart', {
            bubbles: true,
            cancelable: true,
            dataTransfer: new DataTransfer()
        });
        source.dispatchEvent(dragStartEvent);

        // Simulate dragover on canvas
        const dragOverEvent = new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            dataTransfer: dragStartEvent.dataTransfer
        });
        const overPrevented = !canvas.dispatchEvent(dragOverEvent); // dispatchEvent returns false if preventDefault was called
        
        if (!overPrevented) return "DragOver was NOT prevented";

        // Simulate drop on canvas
        const dropEvent = new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            dataTransfer: dragStartEvent.dataTransfer
        });
        const dropPrevented = !canvas.dispatchEvent(dropEvent);
        
        return overPrevented ? "SUCCESS" : "FAIL";
    }, unitId);

    expect(dropSuccess).toBe("SUCCESS");
  });
});