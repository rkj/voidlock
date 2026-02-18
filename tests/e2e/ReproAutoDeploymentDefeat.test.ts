import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Repro: Auto-deployment failure triggers instant loss", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1280, height: 800 });
    page.on("console", (msg) => console.log("BROWSER:", msg.text()));
  }, 30000);

  afterAll(async () => {
    await closeBrowser();
  });

  it("should start mission and NOT result in instant loss when starting without manual deployment", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector("#btn-menu-custom");

    // 1. Enter Custom Mission Setup
    console.log("Entering Custom Mission Setup...");
    await page.click("#btn-menu-custom");
    await page.waitForSelector("#screen-mission-setup", { visible: true });

    // 2. Ensure Manual Deployment is ENABLED (to trigger the deployment phase)
    console.log("Ensuring Manual Deployment is enabled...");
    await page.evaluate(() => {
        const toggle = document.getElementById("toggle-manual-deployment") as HTMLInputElement;
        if (toggle && !toggle.checked) {
            toggle.click();
        }
    });

    // 3. Go to Equipment Screen
    console.log("Navigating to Equipment Screen...");
    await page.click("#btn-goto-equipment");
    await page.waitForSelector(".equipment-screen", { visible: true });

    // 4. Add a soldier to the squad
    console.log("Adding soldier to squad...");
    await page.waitForSelector(".soldier-widget-roster.clickable");
    await page.click(".soldier-widget-roster.clickable");

    // 5. Confirm Squad
    console.log("Confirming squad...");
    await page.waitForSelector("[data-focus-id='btn-confirm-squad']", { visible: true });
    await page.click("[data-focus-id='btn-confirm-squad']");

    // NEW: We are back at Mission Setup, MUST click Launch Mission
    console.log("Launching Mission...");
    await page.waitForSelector("#btn-launch-mission", { visible: true });
    await page.click("#btn-launch-mission");

    // 6. Mission Deployment Phase
    console.log("Waiting for Mission Deployment Phase...");
    await page.waitForSelector(".deployment-summary", { visible: true });

    // NEW: Autofill deployment to enable Start Mission
    console.log("Autofilling deployment...");
    await page.waitForSelector("#btn-autofill-deployment", { visible: true });
    await page.click("#btn-autofill-deployment");

    // 7. Check if Start Mission button is enabled
    console.log("Checking if Start Mission button is enabled...");
    await page.waitForSelector("#btn-start-mission:not([disabled])", { visible: true });
    const startBtn = await page.waitForSelector("#btn-start-mission");
    if (!startBtn) throw new Error("Start Mission button not found");
    
    const isDisabled = await page.evaluate(() => {
        const btn = document.getElementById("btn-start-mission") as HTMLButtonElement;
        return btn.disabled;
    });

    if (isDisabled) {
        console.log("Start Mission button is DISABLED. This might be part of the bug if units are technically at spawn points.");
    } else {
        console.log("Start Mission button is ENABLED.");
    }

    // 8. Click Start Mission anyway (even if disabled, we try to see what happens or if we can enable it)
    console.log("Starting mission...");
    await page.evaluate(() => {
        const btn = document.getElementById("btn-start-mission") as HTMLButtonElement;
        btn.disabled = false; // Force enable for repro if needed
        btn.click();
    });
    
    // 9. Wait for mission to start and check status
    console.log("Waiting for mission to settle...");
    await new Promise(r => setTimeout(r, 2000));

    const status = await page.evaluate(() => {
        const gameOverTitle = document.querySelector(".game-over-title");
        if (gameOverTitle) return gameOverTitle.textContent;
        return "Playing";
    });

    console.log("Mission status after start:", status);
    
    // According to the bug report, this should be "Squad Wiped" or similar (instant loss)
    // If it's "Playing", then we didn't reproduce it yet, or the bug is different.
    expect(status).not.toBe("Squad Wiped");
    expect(status).toBe("Playing");
  }, 120000);
});
