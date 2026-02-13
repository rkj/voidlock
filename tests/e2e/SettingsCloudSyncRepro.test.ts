import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Settings Cloud Sync Repro", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should show 'Service Unavailable' when Firebase is not configured", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Go to Settings
    await page.waitForSelector("#btn-menu-settings");
    
    // Mock missing Firebase config in AppContext
    await page.evaluate(() => {
      const app = (window as any).GameAppInstance;
      if (app && app.context && app.context.cloudSync) {
        app.context.cloudSync.isConfigured = () => false;
      }
    });

    await page.click("#btn-menu-settings");

    // Wait for settings screen
    await page.waitForSelector("#screen-settings");

    // Check for "Cloud Sync Service Unavailable (Firebase not configured)"
    const errorText = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll("div")).find(d => 
        d.textContent?.includes("Cloud Sync Service Unavailable (Firebase not configured)")
      );
      return el ? el.textContent : null;
    });

    expect(errorText).toContain("Cloud Sync Service Unavailable (Firebase not configured)");

    // Check that the Cloud Sync section is still visible
    const isSectionVisible = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll("h3"));
      const accountHeader = headers.find(h => h.textContent === "Account & Cloud Sync");
      if (!accountHeader) return false;
      
      let current: HTMLElement | null = accountHeader;
      while (current) {
        if (window.getComputedStyle(current).display === "none") return false;
        current = current.parentElement;
      }
      return true;
    });

    expect(isSectionVisible).toBe(true);
    
    // Take screenshot for visual proof
    await page.setViewport({ width: 1024, height: 768 });
    await page.screenshot({ path: "screenshots/repro_cloud_sync_unavailable.png" });
  });

  it("should show 'Service Unavailable' when cloudSync service is missing entirely", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.waitForSelector("#btn-menu-settings", { visible: true });

    // Mock missing cloudSync service entirely
    await page.evaluate(() => {
      const app = (window as any).GameAppInstance;
      if (app && app.context) {
        app.context.cloudSync = null;
      }
    });

    await page.click("#btn-menu-settings");

    // Wait for settings screen
    await page.waitForSelector("#screen-settings");

    // Check for "Cloud Sync Service Unavailable"
    const errorText = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll("div")).find(d => 
        d.textContent === "Cloud Sync Service Unavailable"
      );
      return el ? el.textContent : null;
    });

    expect(errorText).toBe("Cloud Sync Service Unavailable");
    
    // Take screenshot for visual proof
    await page.setViewport({ width: 1024, height: 768 });
    await page.screenshot({ path: "screenshots/repro_cloud_sync_missing_service.png" });
  });
});
