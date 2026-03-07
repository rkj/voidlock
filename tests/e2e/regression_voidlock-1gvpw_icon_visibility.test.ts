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

    // 2. Setup Campaign (Skip Prologue to stay on Sector Map)
    await page.waitForSelector("#campaign-skip-prologue");
    await page.click("#campaign-skip-prologue");
    
    await page.waitForSelector('[data-focus-id="btn-start-campaign"]');
    await page.click('[data-focus-id="btn-start-campaign"]');

    // 3. Wait for Sector Map nodes
    await page.waitForSelector(".campaign-node", { visible: true });
    
    // Stabilize layout
    await new Promise(r => setTimeout(r, 1000));

    // 4. Audit icon visibility and size
    const auditData = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll(".campaign-node"));
      const viewport = document.querySelector(".campaign-map-viewport");
      const mapContent = document.querySelector(".campaign-map-content");
      const screen = document.getElementById("screen-campaign");
      const app = document.getElementById("app");
      
      const vRect = viewport?.getBoundingClientRect();
      const cRect = mapContent?.getBoundingClientRect();
      const sRect = screen?.getBoundingClientRect();
      const aRect = app?.getBoundingClientRect();
      const sStyle = screen ? window.getComputedStyle(screen) : null;

      const nodeMetrics = nodes.map(node => {
        const nodeIcon = node.querySelector(".node-icon") as HTMLElement;
        const svg = nodeIcon?.querySelector("svg");
        
        const innerHTML = nodeIcon ? nodeIcon.innerHTML : "MISSING";
        
        const rect = svg?.getBoundingClientRect() || { width: 0, height: 0 };
        const nodeRect = node.getBoundingClientRect();
        const style = svg ? window.getComputedStyle(svg) : null;
        const iconStyle = window.getComputedStyle(nodeIcon);
        const nodeStyle = window.getComputedStyle(node);

        return {
          exists: !!svg,
          width: rect.width,
          height: rect.height,
          nodeWidth: nodeRect.width,
          nodeHeight: nodeRect.height,
          nodeDisplay: nodeStyle.display,
          visible: style ? (style.display !== "none" && style.visibility !== "hidden" && iconStyle.display !== "none") : false,
          opacity: style ? parseFloat(style.opacity || "1") : 0,
          parentWidth: parseFloat(iconStyle.width),
          parentHeight: parseFloat(iconStyle.height),
          innerHTML
        };
      });

      return {
        app: aRect ? { width: aRect.width, height: aRect.height } : null,
        screen: sRect ? { width: sRect.width, height: sRect.height } : null,
        screenDisplay: sStyle?.display,
        hash: window.location.hash,
        viewport: vRect ? { width: vRect.width, height: vRect.height } : null,
        mapContent: cRect ? { width: cRect.width, height: cRect.height } : null,
        nodeMetrics
      };
    });

    console.log("Audit Data:", JSON.stringify(auditData, null, 2));
    const iconMetrics = auditData.nodeMetrics;

    // Take a screenshot for visual proof
    await page.screenshot({ path: "tests/e2e/__snapshots__/voidlock-1gvpw_debug.png" });

    // ASSERT: All nodes must have icons
    expect(iconMetrics.length).toBeGreaterThan(0);
    
    for (const metric of iconMetrics) {
      expect(metric.exists, "Node icon element and SVG should exist").toBe(true);
      
      // These should now PASS if the fix is correct
      expect(metric.width, `SVG width should be at least 16px. Node innerHTML: ${metric.innerHTML}`).toBeGreaterThanOrEqual(16);
      expect(metric.height, "SVG height should be at least 16px").toBeGreaterThanOrEqual(16);
      
      expect(metric.visible, "SVG should be visible").toBe(true);
      expect(metric.opacity, "SVG opacity should be greater than 0").toBeGreaterThan(0);
    }
  });
});
