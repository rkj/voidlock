import { expect, test, describe, beforeAll, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Deployment Wrong Unit Selection", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1280, height: 800 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  test("Dragging a unit from a stacked cell should move the top-most unit", async () => {
    page.on("console", (msg) => console.log(`[BROWSER] ${msg.text()}`));
    await page.goto(E2E_URL, { waitUntil: "load" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "load" });
    
    await page.waitForFunction(() => (window as any).__VOIDLOCK_READY__ === true);

    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");

    // Map Setup - Use 6x6 to ensure it fits in viewport
    await page.waitForSelector("#map-width");
    await page.evaluate(() => {
        const width = document.getElementById("map-width") as HTMLInputElement;
        const height = document.getElementById("map-height") as HTMLInputElement;
        const spawns = document.getElementById("map-spawn-points") as HTMLInputElement;
        if (width) width.value = "6";
        if (height) height.value = "6";
        if (spawns) {
            spawns.value = "1";
            spawns.dispatchEvent(new Event("input"));
            spawns.dispatchEvent(new Event("change"));
        }
        const manual = document.getElementById("toggle-manual-deployment") as HTMLInputElement;
        if (manual && !manual.checked) manual.click();
    });

    await page.click("#btn-launch-mission");
    await page.waitForSelector("#game-canvas", { visible: true });
    
    await page.waitForFunction(() => {
        // @ts-ignore
        const app = window.GameAppInstance;
        return app && app.renderer !== null;
    });
    
    await new Promise(r => setTimeout(r, 2000)); 

    const spawnPoint = await page.evaluate(() => {
        // @ts-ignore
        const app = window.GameAppInstance;
        const state = app.registry.missionRunner.getCurrentGameState();
        return state.map.squadSpawns?.[0] || state.map.squadSpawn;
    });

    // Deploy units
    await page.evaluate((sp) => {
        // @ts-ignore
        const app = window.GameAppInstance;
        const state = app.registry.missionRunner.getCurrentGameState();
        state.units.forEach(u => {
            if (u.archetypeId !== "vip") {
                app.gameClient.applyCommand({
                    type: "DEPLOY_UNIT",
                    unitId: u.id,
                    target: { x: sp.x + 0.5, y: sp.y + 0.5 }
                });
            }
        });
    }, spawnPoint);
    await new Promise(r => setTimeout(r, 1000));

    // Get pixel coords directly from element
    const canvasHandle = await page.$("#game-canvas");
    const box = await canvasHandle?.boundingBox();
    if (!box) throw new Error("Canvas box not found");

    const pixelCoords = await page.evaluate((sp) => {
        // @ts-ignore
        const app = window.GameAppInstance;
        const cellSize = app.renderer.cellSize;
        return {
            x: (sp.x + 0.5) * cellSize,
            y: (sp.y + 0.5) * cellSize
        };
    }, spawnPoint);

    const canvasSize = await page.evaluate(() => {
        const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
        return { width: canvas.width, height: canvas.height };
    });

    const scaleX = box.width / canvasSize.width;
    const scaleY = box.height / canvasSize.height;

    const startX = box.x + pixelCoords.x * scaleX;
    const startY = box.y + pixelCoords.y * scaleY;
    const targetX = startX + 100;
    const targetY = startY + 100;

    const initialDeployedIds = await page.evaluate(() => {
        // @ts-ignore
        const app = window.GameAppInstance;
        const state = app.registry.missionRunner.getCurrentGameState();
        return state.units.filter(u => u.isDeployed !== false).map(u => u.id);
    });
    const lastUnitId = initialDeployedIds[initialDeployedIds.length - 1];

    console.log(`Dragging from ${startX},${startY} to ${targetX},${targetY}`);

    // Ensure we are inside viewport
    if (startY >= 800) {
        console.warn("WARNING: startY is off-screen! Scrolling...");
        await page.evaluate((y) => window.scrollTo(0, y - 400), startY);
    }

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await new Promise(r => setTimeout(r, 200));
    await page.mouse.move(targetX, targetY, { steps: 5 });
    await page.mouse.up();
    
    await new Promise(r => setTimeout(r, 1000));

    const finalDeployedIds = await page.evaluate(() => {
        // @ts-ignore
        const app = window.GameAppInstance;
        const state = app.registry.missionRunner.getCurrentGameState();
        return state.units.filter(u => u.isDeployed !== false).map(u => u.id);
    });

    expect(finalDeployedIds, "The top-most unit should have been moved").not.toContain(lastUnitId);
  }, 60000);
});
