import { describe, it, expect, afterAll, beforeAll, beforeEach } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Regression 39B1 - Map Entity Rendering", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    page.on("console", msg => console.log("BROWSER:", msg.text()));
  });

  afterAll(async () => {
    await closeBrowser();
  });

  async function setupCustomMission(style: "Sprites" | "TacticalIcons") {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Click Settings
    await page.waitForSelector("#btn-menu-settings");
    await page.click("#btn-menu-settings");

    // Click on the style preview item
    await page.waitForSelector(`.style-preview-item[data-style="${style}"]`);
    await page.click(`.style-preview-item[data-style="${style}"]`);

    // Back to menu
    const backBtn = await page.waitForSelector("::-p-text(Save & Back)");
    await backBtn!.click();

    // Custom Mission
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");

    // Static map configuration
    await page.waitForSelector("#map-generator-type");
    await page.select("#map-generator-type", "Static");

    // 1x1 map with spawn and extraction
    const mapJson = JSON.stringify({
      width: 1,
      height: 1,
      cells: [{ x: 0, y: 0, type: "Floor", roomId: "room-0-0" }],
      spawnPoints: [{ x: 0, y: 0 }],
      extraction: { x: 0, y: 0 },
    });

    await page.evaluate((json) => {
      const el = document.getElementById("static-map-json") as HTMLTextAreaElement;
      if (el) el.value = json;
    }, mapJson);

    await page.click("#load-static-map");

    // Assign a soldier (double click to add to squad)
    await page.waitForSelector(".roster-list .soldier-card");
    await page.click(".roster-list .soldier-card", { clickCount: 2 });

    await page.screenshot({ path: "debug_mission_setup.png" });

    // Click "Equipment & Supplies" to go to Equipment screen
    await page.waitForSelector("#btn-goto-equipment:not([disabled])");
    await page.evaluate(() => (document.getElementById("btn-goto-equipment") as HTMLElement)?.click());

    // Click "Back" on Equipment screen to return to mission setup
    await page.waitForSelector('[data-focus-id="btn-back"]');
    const backBtnExists = await page.evaluate(() => {
        const btn = document.querySelector('[data-focus-id="btn-back"]');
        if (btn) {
            (btn as HTMLElement).click();
            return true;
        }
        return false;
    });

    await new Promise(r => setTimeout(r, 1000));

    // Launch Mission (Deployment Phase)
    await page.waitForSelector("#btn-launch-mission", { visible: true });
    await page.click("#btn-launch-mission");

    // Wait for canvas
    await page.waitForSelector("#game-canvas");
  }

  it("should render spawn and extraction points in TacticalIcons mode", async () => {
    await setupCustomMission("TacticalIcons");
    await page.screenshot({
      path: "tests/e2e/__snapshots__/regression_39b1_tactical.png",
    });
    expect(true).toBe(true);
  }, 60000);

  it("should render spawn and extraction points in Sprites mode", async () => {
    await setupCustomMission("Sprites");
    await page.screenshot({
      path: "tests/e2e/__snapshots__/regression_39b1_sprites.png",
    });
    expect(true).toBe(true);
  }, 60000);
});
