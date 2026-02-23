import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("voidlock-19uqe: Unit Overlap Visual Verification", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
  }, 30000);

  afterAll(async () => {
    await closeBrowser();
  });

  it("should deploy 4 units to the same cell and verify they are visually distinct", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    
    // Set up custom config with 1 spawn point and 4 soldiers
    await page.evaluate(() => {
        const config = {
            mapWidth: 2,
            mapHeight: 2,
            spawnPointCount: 1,
            manualDeployment: false, // Auto-deploy to the single spawn point
            squadConfig: {
                soldiers: [
                    { archetypeId: "assault", tacticalNumber: 1 },
                    { archetypeId: "medic", tacticalNumber: 2 },
                    { archetypeId: "scout", tacticalNumber: 3 },
                    { archetypeId: "heavy", tacticalNumber: 4 }
                ],
                inventory: { medkit: 1 }
            },
            mapGeneratorType: "Procedural"
        };
        localStorage.setItem("voidlock_custom_config", JSON.stringify(config));
    });

    await page.goto(E2E_URL);
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");

    // Launch Mission
    await page.waitForSelector("#btn-launch-mission");
    await page.click("#btn-launch-mission");

    // Wait for Mission to start
    await page.waitForSelector("#game-canvas");
    await new Promise(r => setTimeout(r, 2000)); // Wait for rendering and initial movement to settle

    // Check unit positions in GameState
    const data = await page.evaluate(() => {
        // @ts-ignore
        const app = window.GameAppInstance;
        const state = app.registry.missionRunner.getCurrentGameState();
        return {
            units: state.units.map((u: any) => ({
                id: u.id,
                tacticalNumber: u.tacticalNumber,
                pos: u.pos,
                cell: { x: Math.floor(u.pos.x), y: Math.floor(u.pos.y) }
            })),
            spawns: state.map.squadSpawns
        };
    });

    console.log("Spawns:", JSON.stringify(data.spawns));
    console.log("Unit Positions:", JSON.stringify(data.units, null, 2));

    const unitPositions = data.units;
    // Verify at least some units are in the same cell (if map has multiple spawns, they might split)
    const cellCounts = new Map<string, number>();
    unitPositions.forEach((u: any) => {
        const key = `${u.cell.x},${u.cell.y}`;
        cellCounts.set(key, (cellCounts.get(key) || 0) + 1);
    });
    
    console.log("Cell Counts:", JSON.stringify(Object.fromEntries(cellCounts)));
    
    const overlappingCells = Array.from(cellCounts.entries()).filter(([_, count]) => count > 1);
    expect(overlappingCells.length).toBeGreaterThan(0);

    // For units in the SAME cell, check their distance
    const firstOverlappingCell = overlappingCells[0][0];
    const unitsInCell = unitPositions.filter((u: any) => `${u.cell.x},${u.cell.y}` === firstOverlappingCell);
    
    let minDistance = Infinity;
    for (let i = 0; i < unitsInCell.length; i++) {
        for (let j = i + 1; j < unitsInCell.length; j++) {
            const dist = Math.sqrt(
                Math.pow(unitsInCell[i].pos.x - unitsInCell[j].pos.x, 2) +
                Math.pow(unitsInCell[i].pos.y - unitsInCell[j].pos.y, 2)
            );
            minDistance = Math.min(minDistance, dist);
        }
    }
    console.log(`Minimum distance between units in cell ${firstOverlappingCell}: ${minDistance}`);

    // If they have random jitter [-0.2, 0.2], min distance could be very small (e.g. 0.01)
    // We want it to be at least 0.3 for them to be "distinct" quadrants.
    expect(minDistance).toBeGreaterThan(0.3);
  });
});
