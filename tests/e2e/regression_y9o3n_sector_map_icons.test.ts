import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Regression Guard y9o3n: Sector Map Icons and Labels", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    // Use clear state to ensure no leftover campaigns
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should display SVG icons for mission nodes and NO Rank labels", async () => {
    await page.goto(E2E_URL);
    await page.setViewport({ width: 1024, height: 768 });

    // 1. Enter Campaign
    await page.waitForSelector("#btn-menu-campaign");
    await page.click("#btn-menu-campaign");

    // 2. Initialize Expedition (Start Campaign)
    await page.waitForSelector('[data-focus-id="btn-start-campaign"]');
    await page.click('[data-focus-id="btn-start-campaign"]');

    // 3. Wait for Sector Map
    await page.waitForSelector(".campaign-node");

    // Audit nodes
    const nodeData = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll(".campaign-node"));
      return nodes.map(node => {
        const text = node.textContent?.trim() || "";
        const hasSvg = node.querySelector("svg") !== null;
        // Check for non-SVG icons (emojis or text)
        const nodeIcon = node.querySelector(".node-icon");
        const iconText = nodeIcon ? nodeIcon.textContent?.trim() || "" : "";
        const isEmoji = Array.from(iconText).some(char => char.charCodeAt(0) > 127);
        
        return {
          text,
          hasSvg,
          isEmoji,
          iconText
        };
      });
    });

    console.log("Node Audit Data:", JSON.stringify(nodeData, null, 2));

    // ASSERT: No node element contains text matching /Rank \d+/
    for (const node of nodeData) {
      expect(node.text, `Node should not contain Rank label: "${node.text}"`).not.toMatch(/Rank\s+\d+/i);
    }

    // ASSERT: Node icons are SVG elements (not emoji text content)
    for (const node of nodeData) {
      expect(node.hasSvg, "Node should have an SVG icon").toBe(true);
      expect(node.isEmoji, `Node icon should not be an emoji: "${node.iconText}"`).toBe(false);
    }
    
    // Take screenshot for visual verification
    await page.screenshot({ path: "tests/e2e/__snapshots__/y9o3n_sector_map_icons.png" });
  });
});
