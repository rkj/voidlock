import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Verify Auto-Deploy", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1280, height: 800 });
  }, 30000);

  afterAll(async () => {
    await closeBrowser();
  });

  it("should auto-deploy soldiers when manual deployment is disabled", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "load" });
    
    // Wait for App to be ready
    await page.waitForFunction(() => (window as any).__VOIDLOCK_READY__ === true);

    await page.waitForSelector("#btn-menu-custom");

    // 1. Enter Custom Mission Setup
    console.log("Entering Custom Mission Setup...");
    await page.evaluate(() => {
        const btn = document.getElementById("btn-menu-custom");
        if (btn) btn.click();
    });
    await page.waitForSelector("#screen-mission-setup", { visible: true });

    // 2. Disable Manual Deployment
    console.log("Disabling Manual Deployment...");
    await page.evaluate(() => {
        const toggle = document.getElementById("toggle-manual-deployment") as HTMLInputElement;
        if (toggle && toggle.checked) {
            toggle.click();
        }
    });

    // 3. Go to Equipment Screen
    await page.evaluate(() => {
        const btn = document.getElementById("btn-goto-equipment");
        if (btn) btn.click();
    });
    await page.waitForSelector(".equipment-screen", { visible: true });
    
    // We assume default roster has soldiers.

    // 4. Back to Setup and Launch
    console.log("Back to Setup and Launch...");
    await page.waitForSelector("#screen-equipment .back-button", { visible: true });
    await page.evaluate(() => {
        const btn = document.querySelector("#screen-equipment .back-button") as HTMLElement;
        if (btn) btn.click();
    });

    await page.waitForSelector("#btn-launch-mission", { visible: true });
    await page.evaluate(() => {
        const btn = document.getElementById("btn-launch-mission");
        if (btn) btn.click();
    });

    // 5. Wait for game start
    console.log("Waiting for mission to settle...");
    await new Promise(r => setTimeout(r, 2000));

    const status = await page.evaluate(() => {
        const gameOverTitle = document.querySelector(".game-over-title");
        if (gameOverTitle) return gameOverTitle.textContent;
        return "Playing";
    });

    console.log("Mission status:", status);
    
    // If bug exists, this might be "Squad Wiped"
    // If working correctly, this should be "Playing"
    if (status === "Squad Wiped") {
        console.log("BUG REPRODUCED: Instant loss despite having soldiers.");
    } else {
        console.log("NO BUG: Game is playing.");
    }
    
    // For now, let's just assert "Playing" to see if it fails (reproducing the bug)
    expect(status).toBe("Playing"); 
  }, 120000);
});
