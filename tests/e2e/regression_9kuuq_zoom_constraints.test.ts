import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Zoom Constraints Regression (voidlock-9kuuq)", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should start with map fitting container and enforce zoom-out limits", async () => {
    console.log("Navigating to", E2E_URL);
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 1. Enter Custom Mission Setup
    console.log("Entering Custom Mission Setup...");
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");

    // 2. Set Map Size to 20x20
    console.log("Setting map size to 20x20...");
    await page.waitForSelector("#map-width");
    await page.focus("#map-width");
    await page.keyboard.down("Control");
    await page.keyboard.press("a");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    await page.type("#map-width", "20");

    await page.focus("#map-height");
    await page.keyboard.down("Control");
    await page.keyboard.press("a");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    await page.type("#map-height", "20");
    
    await page.screenshot({ path: "tests/e2e/__snapshots__/zoom_setup_check.png" });

    // Ensure manual deployment is checked
    const deploymentToggle = await page.waitForSelector("#toggle-manual-deployment");
    const isChecked = await page.$eval("#toggle-manual-deployment", (el: any) => el.checked);
    if (!isChecked) {
      await deploymentToggle!.click();
    }

    // Ensure we have units in the roster or squad slots
    console.log("Waiting for squad builder cards...");
    await page.waitForSelector(".soldier-widget-squad-builder", { visible: true });
    
    // 3. Launch Mission
    console.log("Launching mission...");
    const launchBtn = await page.waitForSelector("#btn-launch-mission:not([disabled])");
    await launchBtn!.click();

    // 4. Auto-Fill and Start
    console.log("Waiting for deployment phase...");
    await page.waitForSelector("#btn-autofill-deployment", { visible: true });
    await page.click("#btn-autofill-deployment");
    
    console.log("Waiting for #btn-start-mission to be enabled...");
    await page.waitForSelector("#btn-start-mission:not([disabled])", { visible: true });
    await page.click("#btn-start-mission");

    // 5. Wait for tactical mission view
    console.log("Waiting for game canvas...");
    await page.waitForSelector("#game-canvas", { visible: true });
    
    // Wait for renderer initialization and first frame
    await new Promise(r => setTimeout(r, 2000));

    const getDimensions = async () => {
      return await page.evaluate(() => {
        const container = document.getElementById("game-container");
        const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
        
        const rect = container?.getBoundingClientRect();
        return {
          containerWidth: rect?.width || 0,
          containerHeight: rect?.height || 0,
          clientWidth: container?.clientWidth || 0,
          clientHeight: container?.clientHeight || 0,
          mapWidth: canvas?.width || 0,
          mapHeight: canvas?.height || 0
        };
      });
    };

    // 6. INITIAL ZOOM ASSERTION
    console.log("Checking initial zoom...");
    const initial = await getDimensions();
    console.log("Initial dimensions:", initial);
    
    expect(initial.mapWidth, "Map width should be > 0").toBeGreaterThan(0);
    expect(initial.mapHeight, "Map height should be > 0").toBeGreaterThan(0);

    // ASSERT: Map fills container in at least one dimension
    // Viewport 1024x768. Map 20x20. fitHeight = 768/20 = 38.4. fitWidth = 1024/20 = 51.2.
    // min(51.2, 38.4) = 38.4. cellSize = 38.4.
    // mapWidth = 20 * 38.4 = 768. mapHeight = 20 * 38.4 = 768.
    // Height fits exactly (768).
    expect(
      initial.mapWidth >= initial.containerWidth || 
      initial.mapHeight >= initial.containerHeight,
      "Map should fill container in at least one dimension initially"
    ).toBe(true);

    // ASSERT: More than 50% visible
    const visibleWidth = Math.min(initial.mapWidth, initial.containerWidth);
    const visibleHeight = Math.min(initial.mapHeight, initial.containerHeight);
    const visibleArea = visibleWidth * visibleHeight;
    const totalArea = initial.mapWidth * initial.mapHeight;
    const visiblePercent = visibleArea / totalArea;
    console.log("Visible %:", (visiblePercent * 100).toFixed(1) + "%");
    expect(visiblePercent, "At least 50% of the map should be visible initially").toBeGreaterThanOrEqual(0.5);

    await page.screenshot({ path: "tests/e2e/__snapshots__/zoom_initial.png" });

    // 7. ZOOM-OUT LIMIT ASSERTION
    console.log("Zooming out to max limit...");
    
    // Move mouse to center of canvas to ensure wheel events reach it
    const canvas = await page.waitForSelector("#game-canvas");
    const box = await canvas!.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    }

    // Scroll wheel down multiple times to zoom out to the max
    for (let i = 0; i < 30; i++) {
      await page.mouse.wheel({ deltaY: 100 });
      // Small delay to allow any processing
      await new Promise(r => setTimeout(r, 20));
    }
    
    // Wait for settle
    await new Promise(r => setTimeout(r, 1000));

    const zoomedOut = await getDimensions();
    console.log("Zoomed out dimensions:", zoomedOut);

    // ASSERT: Map never becomes smaller than container in BOTH dimensions
    expect(
      zoomedOut.mapWidth >= zoomedOut.containerWidth || 
      zoomedOut.mapHeight >= zoomedOut.containerHeight,
      "Map should never become smaller than the container in both dimensions after max zoom-out"
    ).toBe(true);

    await page.screenshot({ path: "tests/e2e/__snapshots__/zoom_max_out.png" });
  }, 120000);
});
