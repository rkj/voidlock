import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Regression Guard voidlock-1gvpw: Sector Map Icon Visibility", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should verify that node icons are visible, rendered, and correctly sized", async () => {
    await page.goto(E2E_URL);
    await page.setViewport({ width: 1024, height: 768 });

    // 1. Enter Campaign
    await page.waitForSelector("#btn-menu-campaign");
    await page.click("#btn-menu-campaign");

    // 2. Start Campaign (Initialize Expedition)
    await page.waitForSelector('[data-focus-id="btn-start-campaign"]');
    await page.click('[data-focus-id="btn-start-campaign"]');

    // 3. Wait for Sector Map nodes
    await page.waitForSelector(".campaign-node");

    // 4. Audit icon visibility and size
    const iconMetrics = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll(".campaign-node"));
      return nodes.map(node => {
        const nodeIcon = node.querySelector(".node-icon");
        const svg = nodeIcon?.querySelector("svg");
        
        if (!nodeIcon || !svg) {
          const text = node.textContent?.trim() || "";
          return {
            exists: false,
            width: 0,
            height: 0,
            visible: false,
            opacity: 0,
            text
          };
        }

        const rect = svg.getBoundingClientRect();
        const style = window.getComputedStyle(svg);
        const iconStyle = window.getComputedStyle(nodeIcon);

        return {
          exists: true,
          width: rect.width,
          height: rect.height,
          visible: style.display !== "none" && style.visibility !== "hidden" && iconStyle.display !== "none",
          opacity: parseFloat(style.opacity || "1"),
          parentWidth: parseFloat(iconStyle.width),
          parentHeight: parseFloat(iconStyle.height)
        };
      });
    });

    console.log("Icon Metrics:", JSON.stringify(iconMetrics, null, 2));

    // Take a screenshot for visual proof BEFORE assertions
    await page.screenshot({ path: "tests/e2e/__snapshots__/voidlock-1gvpw_icon_audit.png" });

    // ASSERT: All nodes must have icons
    expect(iconMetrics.length).toBeGreaterThan(0);
    
    for (const metric of iconMetrics) {
      expect(metric.exists, "Node icon element and SVG should exist").toBe(true);
      
      // These are expected to FAIL currently if the bug is present
      expect(metric.width, "SVG width should be at least 16px").toBeGreaterThanOrEqual(16);
      expect(metric.height, "SVG height should be at least 16px").toBeGreaterThanOrEqual(16);
      
      expect(metric.visible, "SVG should be visible").toBe(true);
      expect(metric.opacity, "SVG opacity should be greater than 0").toBeGreaterThan(0);
    }
  });
});
