import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("voidlock-1yb5o: Auto-Fill Overlap Repro", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  }, 30000);

  afterAll(async () => {
    await closeBrowser();
  });

  it("should deploy all 4 units using Auto-Fill even if there are fewer spawn points", async () => {
    await page.goto(E2E_URL);
    
    // Set up custom config in localStorage
    await page.evaluate(() => {
        const config = {
            mapWidth: 2,
            mapHeight: 2,
            spawnPointCount: 1,
            fogOfWarEnabled: true,
            debugOverlayEnabled: false,
            losOverlayEnabled: false,
            agentControlEnabled: true,
            allowTacticalPause: true,
            mapGeneratorType: "Procedural", // SpaceshipGenerator
            missionType: "RecoverIntel",
            lastSeed: 12345,
            startingThreatLevel: 0,
            baseEnemyCount: 3,
            enemyGrowthPerMission: 1,
            bonusLootCount: 0,
            debugSnapshotInterval: 0,
            manualDeployment: true,
            squadConfig: {
                soldiers: [
                    { archetypeId: "assault" },
                    { archetypeId: "medic" },
                    { archetypeId: "scout" },
                    { archetypeId: "heavy" }
                ],
                inventory: { medkit: 1, frag_grenade: 2 }
            }
        };
        localStorage.setItem("voidlock_custom_config", JSON.stringify(config));
    });

    // Reload to apply config
    await page.goto(E2E_URL);
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");

    // Launch Mission
    await page.waitForSelector("#btn-launch-mission");
    await page.click("#btn-launch-mission");

    // Wait for Deployment Phase
    await page.waitForSelector(".deployment-summary");
    
    // Verify we have 4 units pending
    const unitStates = await page.evaluate(() => {
        // @ts-ignore
        const app = window.GameAppInstance;
        const state = app.registry.missionRunner.getCurrentGameState();
        return state.units.map((u: any) => ({ id: u.id, archetypeId: u.archetypeId, isDeployed: u.isDeployed }));
    });
    console.log("Initial Unit States:", JSON.stringify(unitStates));

    const initialDeployedCount = await page.evaluate(() => {
        const items = document.querySelectorAll(".deployment-unit-item");
        return Array.from(items).filter(item => {
            const span = item.querySelector(".roster-item-details span:last-child") as HTMLElement;
            return span && span.textContent === "Pending";
        }).length;
    });
    expect(initialDeployedCount).toBe(4);

    // Click Auto-Fill Spawns
    await page.click("#btn-autofill-deployment");
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: "debug_autofill_result.png" });

    // Verify all 4 units are deployed
    const finalDeployedCount = await page.evaluate(() => {
        const items = document.querySelectorAll(".deployment-unit-item");
        return Array.from(items).filter(item => {
            const span = item.querySelector(".roster-item-details span:last-child") as HTMLElement;
            return span && span.textContent === "Deployed";
        }).length;
    });

    // THIS IS EXPECTED TO FAIL BEFORE FIX because map has only 1 spawn point
    // but Auto-Fill currently only uses each spawn once.
    expect(finalDeployedCount).toBe(4);
    
    // Also verify "Start Mission" button is enabled
    const isStartDisabled = await page.evaluate(() => {
        const btn = document.getElementById("btn-start-mission") as HTMLButtonElement;
        return btn.disabled;
    });
    expect(isStartDisabled).toBe(false);
  }, 60000);
});
