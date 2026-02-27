import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("voidlock-3x1vj Reproduction: Campaign Map Contrast and Crispness", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should capture the current state of the campaign map for audit", async () => {
    await page.goto(E2E_URL);
    await page.setViewport({ width: 1024, height: 768 });

    // 1. Enter Campaign
    console.log("Waiting for Main Menu...");
    await page.waitForSelector("#screen-main-menu.title-splash-complete", { timeout: 5000 });
    await page.waitForSelector("#btn-menu-campaign");
    console.log("Clicking Campaign button...");
    await page.click("#btn-menu-campaign");

    // 2. Initialize Expedition
    console.log("Waiting for Start Campaign button...");
    const startBtnSelector = '[data-focus-id="btn-start-campaign"]';
    await page.waitForSelector(startBtnSelector);
    console.log("Clicking Start Campaign button...");
    await page.click(startBtnSelector);

    // 3. Wait for Sector Map
    await page.waitForSelector(".campaign-node.accessible");

    // Take screenshots
    await page.screenshot({
      path: "tests/e2e/__snapshots__/campaign_map_audit_1024x768.png",
    });

    await page.setViewport({ width: 400, height: 800 });
    await page.screenshot({
      path: "tests/e2e/__snapshots__/campaign_map_audit_400x800.png",
    });

    // Check if background image is used
    const bgImageValue = await page.evaluate(() => {
      const viewport = document.querySelector(".campaign-map-viewport");
      if (!viewport) return "none";
      return window.getComputedStyle(viewport).backgroundImage;
    });
    console.log("Background Image Value:", bgImageValue);
    expect(bgImageValue).toContain("assets/station.jpg");

    // Check node icon types (emoji check)
    const nodeIcons = await page.evaluate(() => {
      const icons = Array.from(document.querySelectorAll(".campaign-node span"));
      return icons.map(icon => icon.textContent);
    });
    console.log("Node Icons:", nodeIcons);

    // Check scanline z-index
    const scanlineZIndex = await page.evaluate(() => {
      const scanline = document.querySelector(".scanline");
      return scanline ? window.getComputedStyle(scanline).zIndex : "none";
    });
    console.log("Scanline Z-Index:", scanlineZIndex);

    const nodeZIndex = await page.evaluate(() => {
      const node = document.querySelector(".campaign-node");
      return node ? window.getComputedStyle(node).zIndex : "none";
    });
    console.log("Node Z-Index:", nodeZIndex);

    // Verify icons are NOT emojis (Desired state)
    const isUsingEmoji = nodeIcons.some(text => {
        // Simple emoji check: any character code > 127 is likely an emoji in this context
        return text && Array.from(text).some(char => char.charCodeAt(0) > 127);
    });
    
    // Assert DESIRED behavior: should NOT use emojis
    expect(isUsingEmoji, "Campaign nodes should not use low-fidelity emojis").toBe(false);

    // Assert DESIRED behavior: Nodes should be ABOVE the scanline for crispness
    const sZ = scanlineZIndex === "none" ? 0 : parseInt(scanlineZIndex);
    const nZ = nodeZIndex === "none" ? 0 : parseInt(nodeZIndex);
    
    expect(nZ, "Campaign nodes should have higher z-index than scanline").toBeGreaterThan(sZ);
  });
});
