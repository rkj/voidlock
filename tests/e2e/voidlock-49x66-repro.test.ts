import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("voidlock-49x66: Deployment Bug Repro", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1600, height: 1200 });
    
    // Log console messages
    page.on("console", (msg) => {
        console.log(`[BROWSER]: ${msg.text()}`);
    });

    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  }, 30000);

  afterAll(async () => {
    await closeBrowser();
  });

  it("should handle deployment correctly: drag-and-drop, auto-fill, and double-click", async () => {
    await page.goto(E2E_URL);
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");
    
    // Ensure Manual Deployment is ON
    console.log("Waiting for #toggle-manual-deployment");
    await page.waitForSelector("#toggle-manual-deployment");
    const isChecked = await page.evaluate(() => {
        const el = document.getElementById("toggle-manual-deployment") as HTMLInputElement;
        return el.checked;
    });
    if (!isChecked) {
        console.log("Enabling manual deployment...");
        await page.click("#toggle-manual-deployment");
    }

    // Select Dense Ship for predictable spawns
    await page.select("#map-generator-type", "DenseShip");

    console.log("Going to equipment screen...");
    await page.click("#btn-goto-equipment");
    await page.waitForSelector("#screen-equipment", { visible: true });
    
    // Add units to squad
    for (let i = 0; i < 2; i++) {
        console.log(`Checking slot ${i}...`);
        const slotSelector = `.soldier-list-panel div[data-focus-id="soldier-slot-${i}"]`;
        await page.waitForSelector(slotSelector);
        
        const isSlotEmpty = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            return el?.textContent?.includes("Empty Slot");
        }, slotSelector);

        if (isSlotEmpty) {
            console.log(`Slot ${i} is empty, adding soldier...`);
            await page.click(slotSelector);
            await page.waitForSelector(".armory-panel .soldier-card", { visible: true });
            await page.click(".armory-panel .soldier-card");
            await new Promise(r => setTimeout(r, 500)); // Wait for re-render
        }
    }

    // Confirm Squad
    console.log("Confirming squad...");
    await page.waitForSelector("button.primary-button");
    await page.click("button.primary-button");
    
    // Back at Mission Setup
    console.log("Waiting for #btn-launch-mission");
    await page.waitForSelector("#btn-launch-mission", { visible: true });
    
    // Check if button is disabled
    const isLaunchDisabled = await page.evaluate(() => {
        const btn = document.getElementById("btn-launch-mission") as HTMLButtonElement;
        return btn.disabled;
    });
    console.log("Launch Mission disabled:", isLaunchDisabled);
    
    if (isLaunchDisabled) {
        await page.screenshot({ path: "debug_launch_disabled.png" });
        throw new Error("Launch Mission button is disabled!");
    }

    // Launch Mission
    console.log("Launching mission...");
    await page.click("#btn-launch-mission");

    // Wait for Deployment Phase
    console.log("Waiting for deployment phase...");
    try {
        await page.waitForSelector(".deployment-summary", { timeout: 15000 });
    } catch (e) {
        await page.screenshot({ path: "debug_launch_failed.png" });
        const html = await page.content();
        console.log("Current Screen Content (last 500 chars):", html.slice(-500));
        throw e;
    }
    await page.waitForSelector("#game-canvas");

    // Check if Start Mission is disabled initially
    const isStartDisabled = await page.evaluate(() => {
        const btn = document.getElementById("btn-start-mission") as HTMLButtonElement;
        return btn.disabled;
    });
    console.log("Start Mission disabled initially:", isStartDisabled);
    expect(isStartDisabled).toBe(true);

    // --- TEST 1: Double-click to deploy ---
    console.log("Testing double-click to deploy");
    const units = await page.$$(".deployment-unit-item");
    expect(units.length).toBeGreaterThanOrEqual(1);
    
    // Double click first unit
    await units[0].click({ clickCount: 2 });
    await new Promise(r => setTimeout(r, 500));
    
    let statusText0 = await units[0].evaluate(el => {
        const span = el.querySelector(".roster-item-details span:last-child") as HTMLElement;
        return span ? span.textContent : "";
    });
    console.log("Unit 0 status after double-click:", statusText0);
    expect(statusText0).toBe("Deployed");

    // --- TEST 2: Drag and drop to move ---
    console.log("Testing drag and drop to move");
    const spawnPoints = await page.evaluate(() => {
        // @ts-ignore
        const app = window.GameAppInstance;
        const state = app.currentGameState;
        const spawns = state.map.squadSpawns || (state.map.squadSpawn ? [state.map.squadSpawn] : []);
        // @ts-ignore
        const cellSize = app.context.renderer.cellSize;
        const canvas = document.getElementById("game-canvas");
        const rect = canvas?.getBoundingClientRect();
        return spawns.map(s => ({
            x: s.x,
            y: s.y,
            pixelX: rect!.left + (s.x + 0.5) * cellSize,
            pixelY: rect!.top + (s.y + 0.5) * cellSize
        }));
    });

    console.log(`Found ${spawnPoints.length} spawn points`);

    // Drag it from spawnPoints[0] to spawnPoints[1] if it exists
    if (spawnPoints.length > 1) {
        console.log(`Dragging from (${spawnPoints[0].x}, ${spawnPoints[0].y}) to (${spawnPoints[1].x}, ${spawnPoints[1].y})`);
        await page.mouse.move(spawnPoints[0].pixelX, spawnPoints[0].pixelY);
        await page.mouse.down();
        await page.mouse.move(spawnPoints[1].pixelX, spawnPoints[1].pixelY, { steps: 10 });
        await page.mouse.up();
        await new Promise(r => setTimeout(r, 500));
    }

    // --- TEST 3: Undeploy by dragging off-map ---
    console.log("Testing undeploy by dragging off-map");
    const currentSpawn = spawnPoints.length > 1 ? spawnPoints[1] : spawnPoints[0];
    await page.mouse.move(currentSpawn.pixelX, currentSpawn.pixelY);
    await page.mouse.down();
    await page.mouse.move(0, 0, { steps: 10 });
    await page.mouse.up();
    await new Promise(r => setTimeout(r, 500));

    statusText0 = await units[0].evaluate(el => {
        const span = el.querySelector(".roster-item-details span:last-child") as HTMLElement;
        return span ? span.textContent : "";
    });
    console.log("Unit 0 status after dragging off-map:", statusText0);
    expect(statusText0).toBe("Pending");

    // --- TEST 4: Auto-Fill button ---
    console.log("Testing Auto-Fill button");
    await page.waitForSelector("#btn-autofill-deployment");
    await page.click("#btn-autofill-deployment");
    await new Promise(r => setTimeout(r, 500));

    const allDeployed = await page.evaluate(() => {
        const items = document.querySelectorAll(".deployment-unit-item");
        return Array.from(items).every(item => {
            const span = item.querySelector(".roster-item-details span:last-child") as HTMLElement;
            return span && span.textContent === "Deployed";
        });
    });
    console.log("All units deployed after auto-fill:", allDeployed);
    expect(allDeployed).toBe(true);

    // Now Start Mission should be enabled
    const isStartEnabledNow = await page.evaluate(() => {
        const btn = document.getElementById("btn-start-mission") as HTMLButtonElement;
        return !btn.disabled;
    });
    console.log("Start Mission enabled after auto-fill:", isStartEnabledNow);
    expect(isStartEnabledNow).toBe(true);
    
    // Final verification: take a screenshot
    await page.screenshot({ path: "deployment_fixed.png" });
    console.log("Verification screenshot saved to deployment_fixed.png");
  }, 120000); // 2 minute timeout for the whole test
});
