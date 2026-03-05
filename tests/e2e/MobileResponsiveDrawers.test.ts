import { describe, it, expect, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import { E2E_URL } from "./config";
import { KnownDevices } from "puppeteer";

describe("Mobile Responsive Drawers", () => {
  afterAll(async () => {
    await closeBrowser();
  });

  it("should toggle drawers on mobile viewport", async () => {
    const page = await getNewPage();
    await page.emulate(KnownDevices["iPhone 12"]);
    await page.goto(E2E_URL, { waitUntil: "load" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "load" });
    
    // Wait for App to be ready
    await page.waitForFunction(() => (window as any).__VOIDLOCK_READY__ === true);

    // 1. Navigate to Custom Mission Setup
    await page.waitForSelector("#btn-menu-custom", { visible: true });
    await page.click("#btn-menu-custom");

    // 2. Launch Mission
    await page.waitForSelector("#btn-launch-mission", { visible: true });
    await page.click("#btn-launch-mission");

    // 3. Handle Deployment
    await page.waitForSelector("#btn-autofill-deployment", { visible: true });
    await page.click("#btn-autofill-deployment");
    await page.click("#btn-start-mission");

    // 4. Wait for mission screen
    await page.waitForSelector("#screen-mission", { visible: true });
    await page.waitForSelector("#btn-toggle-squad", { visible: true });

    // Verify drawers are initially hidden
    const drawersStateInitial = await page.evaluate(() => {
      const squad = document.getElementById("soldier-panel");
      const right = document.getElementById("right-panel");
      return {
        squadActive: squad?.classList.contains("active"),
        rightActive: right?.classList.contains("active"),
      };
    });

    expect(drawersStateInitial.squadActive).toBe(false);
    expect(drawersStateInitial.rightActive).toBe(false);

    // Toggle Squad Drawer
    await page.click("#btn-toggle-squad");
    await page.waitForSelector("#soldier-panel.active");

    // Toggle Right Drawer (should close squad drawer)
    await page.click("#btn-toggle-right");
    await page.waitForSelector("#right-panel.active");

    const drawersStateAfterRight = await page.evaluate(() => {
      const squad = document.getElementById("soldier-panel");
      const right = document.getElementById("right-panel");
      return {
        squadActive: squad?.classList.contains("active"),
        rightActive: right?.classList.contains("active"),
      };
    });
    expect(drawersStateAfterRight.squadActive).toBe(false);
    expect(drawersStateAfterRight.rightActive).toBe(true);

    // Click game container to close all drawers
    await page.evaluate(() => {
        const el = document.getElementById("game-container");
        if (el) el.click();
    });

    // Wait for transition
    await new Promise((r) => setTimeout(r, 1000));

    const drawersStateFinal = await page.evaluate(() => {
      const squad = document.getElementById("soldier-panel");
      const right = document.getElementById("right-panel");
      return {
        squadActive: squad?.classList.contains("active"),
        rightActive: right?.classList.contains("active"),
      };
    });
    expect(drawersStateFinal.squadActive).toBe(false);
    expect(drawersStateFinal.rightActive).toBe(false);
  }, 90000);
});
