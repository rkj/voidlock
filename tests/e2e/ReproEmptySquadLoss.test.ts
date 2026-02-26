import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Repro: Empty squad triggers instant loss", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1280, height: 800 });
  }, 30000);

  afterAll(async () => {
    await closeBrowser();
  });

  it("should start mission with empty squad and result in instant loss after clicking START", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector("#btn-menu-custom");

    // 1. Enter Custom Mission Setup
    console.log("Entering Custom Mission Setup...");
    await page.click("#btn-menu-custom");
    await page.waitForSelector("#screen-mission-setup", { visible: true });

    // 2. Disable Manual Deployment to trigger instant Playing start
    console.log("Disabling Manual Deployment...");
    await page.evaluate(() => {
        const toggle = document.getElementById("toggle-manual-deployment") as HTMLInputElement;
        if (toggle && toggle.checked) {
            toggle.click();
        }
    });

    // 3. Go to Equipment Screen
    console.log("Navigating to Equipment Screen...");
    await page.click("#btn-goto-equipment");
    await page.waitForSelector(".equipment-screen", { visible: true });

    // 4. Remove default soldiers one by one
    console.log("Removing default soldiers...");
    while (true) {
        const removeBtn = await page.$(".remove-soldier-btn");
        if (!removeBtn) break;
        await removeBtn.click();
        await new Promise(r => setTimeout(r, 100)); // Wait for rerender
    }

    // 5. Confirm Squad
    console.log("Confirming empty squad...");
    await page.waitForSelector("[data-focus-id='btn-back']", { visible: true });
    await page.click("[data-focus-id='btn-back']");

    // NEW: We are back at Mission Setup, MUST click Launch Mission
    console.log("Launching Mission...");
    await page.waitForSelector("#btn-launch-mission", { visible: true });
    await page.click("#btn-launch-mission");

    // 6. It should go to tactical and fail immediately because skipDeployment is true
    console.log("Waiting for mission to settle...");
    await new Promise(r => setTimeout(r, 2000));

    const status = await page.evaluate(() => {
        const gameOverTitle = document.querySelector(".game-over-title");
        if (gameOverTitle) return gameOverTitle.textContent;
        return "Playing";
    });

    console.log("Mission status after start:", status);
    
    expect(status).toBe("Playing");
  }, 120000);
});
