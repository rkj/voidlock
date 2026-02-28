import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("voidlock-tnit7 Repro: Drag and Drop Deployment", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1280, height: 1024 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should move the correct soldier when dragging from a cell with multiple soldiers", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    
    await page.waitForSelector("#btn-menu-custom");
    await page.evaluate(() => (document.getElementById("btn-menu-custom") as HTMLElement).click());

    // Enable Manual Deployment
    await page.waitForSelector("#toggle-manual-deployment");
    const isChecked = await page.$eval("#toggle-manual-deployment", (el: any) => el.checked);
    if (!isChecked) {
      await page.evaluate(() => (document.getElementById("toggle-manual-deployment") as HTMLElement).click());
    }

    // Set Map Size to 6x6
    await page.waitForSelector("#map-width");
    await page.evaluate(() => {
        const wInput = document.getElementById("map-width") as HTMLInputElement;
        const hInput = document.getElementById("map-height") as HTMLInputElement;
        wInput.value = "6";
        hInput.value = "6";
        wInput.dispatchEvent(new Event("input"));
        hInput.dispatchEvent(new Event("input"));
    });

    // Disable AI
    await page.waitForSelector("#toggle-agent-control");
    const isAiChecked = await page.$eval("#toggle-agent-control", (el: any) => el.checked);
    if (isAiChecked) {
      await page.evaluate(() => (document.getElementById("toggle-agent-control") as HTMLElement).click());
    }

    // Launch to Deployment Phase
    console.log("Waiting for #btn-launch-mission");
    await page.waitForSelector("#btn-launch-mission");
    await page.evaluate(() => (document.getElementById("btn-launch-mission") as HTMLElement).click());
    
    await page.waitForSelector(".deployment-summary");

    const canvas = await page.waitForSelector("#game-canvas");
    const canvasBox = await canvas!.boundingBox();
    expect(canvasBox).not.toBeNull();

    // Find first two units in roster
    const unitItems = await page.$$(".deployment-unit-item");
    expect(unitItems.length).toBeGreaterThanOrEqual(2);

    const unit1Id = await unitItems[0].evaluate(el => el.getAttribute("data-unit-id"));
    const unit2Id = await unitItems[1].evaluate(el => el.getAttribute("data-unit-id"));

    const spawns = await page.evaluate(() => {
        const state = (window as any).GameAppInstance.registry.missionRunner.getCurrentGameState();
        return state.map.squadSpawns;
    });
    const spawnPoint = spawns[0];
    const otherSpawnPoint = spawns[1];

    // Deploy unit 1 to spawnPoint via applyCommand
    await page.evaluate((id, x, y) => {
        (window as any).GameAppInstance.registry.gameClient.applyCommand({
            type: "DEPLOY_UNIT",
            unitId: id,
            target: { x: x + 0.5, y: y + 0.5 }
        });
    }, unit1Id, spawnPoint.x, spawnPoint.y);

    // Deploy unit 2 to same spawnPoint via applyCommand
    await page.evaluate((id, x, y) => {
        (window as any).GameAppInstance.registry.gameClient.applyCommand({
            type: "DEPLOY_UNIT",
            unitId: id,
            target: { x: x + 0.5, y: y + 0.5 }
        });
    }, unit2Id, spawnPoint.x, spawnPoint.y);

    const getPixelPos = async (worldX: number, worldY: number) => {
        return await page.evaluate((wx, wy) => {
            const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
            const rect = canvas.getBoundingClientRect();
            const cs = (window as any).GameAppInstance.renderer.cellSize;
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            return {
                x: rect.left + (wx * cs) / scaleX,
                y: rect.top + (wy * cs) / scaleY
            };
        }, worldX, worldY);
    };

    // Wait for state sync
    await new Promise(r => setTimeout(r, 500));

    // Re-verify positions before dragging
    const unit1PosInitial = await page.evaluate((id) => {
        const state = (window as any).GameAppInstance.registry.missionRunner.getCurrentGameState();
        const u = state.units.find((u: any) => u.id === id);
        return u.pos;
    }, unit1Id);
    const unit2PosInitial = await page.evaluate((id) => {
        const state = (window as any).GameAppInstance.registry.missionRunner.getCurrentGameState();
        const u = state.units.find((u: any) => u.id === id);
        return u.pos;
    }, unit2Id);
    console.log("Unit 1 initial pos:", unit1PosInitial);
    console.log("Unit 2 initial pos:", unit2PosInitial);

    // Use actual jittered positions for dragging
    const unit2Pixel = await getPixelPos(unit2PosInitial.x, unit2PosInitial.y);
    const otherSpawnPixel = await getPixelPos(otherSpawnPoint.x + 0.5, otherSpawnPoint.y + 0.5);

    // Hover over Unit 2 - should show grab cursor
    await page.mouse.move(unit2Pixel.x, unit2Pixel.y);
    const cursorHover = await page.$eval("#game-canvas", el => getComputedStyle(el).cursor);
    expect(cursorHover).toBe("grab");

    await page.mouse.down();
    
    // Check for ghost element
    const ghost = await page.$(".deployment-drag-ghost");
    expect(ghost).not.toBeNull();

    // Should show grabbing cursor while dragging
    const cursorDragging = await page.$eval("#game-canvas", el => getComputedStyle(el).cursor);
    expect(cursorDragging).toBe("grabbing");

    await page.mouse.move(otherSpawnPixel.x, otherSpawnPixel.y, { steps: 10 });
    await page.mouse.up();

    // Ghost should be gone after mouse up
    const ghostAfterUp = await page.$(".deployment-drag-ghost");
    expect(ghostAfterUp).toBeNull();

    // Take a screenshot of the final state
    await page.screenshot({ path: "screenshots/voidlock-tnit7_fixed.png" });

    // Wait for state sync
    await new Promise(r => setTimeout(r, 500));

    // Verify which unit moved.
    const unit1Pos = await page.evaluate((id) => {
        const state = (window as any).GameAppInstance.registry.missionRunner.getCurrentGameState();
        const u = state.units.find((u: any) => u.id === id);
        return u.pos;
    }, unit1Id);

    const unit2Pos = await page.evaluate((id) => {
        const state = (window as any).GameAppInstance.registry.missionRunner.getCurrentGameState();
        const u = state.units.find((u: any) => u.id === id);
        return u.pos;
    }, unit2Id);

    console.log("Unit 1 Pos Final:", unit1Pos);
    console.log("Unit 2 Pos Final:", unit2Pos);

    // Unit 1 should still be at the original spawnPoint
    expect(Math.floor(unit1Pos.x)).toBe(spawnPoint.x);
    expect(Math.floor(unit1Pos.y)).toBe(spawnPoint.y);
    
    // Unit 2 should have moved away from the original spawnPoint
    expect(Math.floor(unit2Pos.x)).toBe(otherSpawnPoint.x);
    expect(Math.floor(unit2Pos.y)).toBe(otherSpawnPoint.y);
  }, 120000);
});
