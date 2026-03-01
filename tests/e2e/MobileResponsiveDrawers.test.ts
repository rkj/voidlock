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

    // Navigate to mission
    await page.waitForSelector("#btn-menu-custom", { visible: true });
    await new Promise((r) => setTimeout(r, 500)); // Stabilize
    await page.evaluate(() => {
        const btn = document.getElementById("btn-menu-custom");
        if (btn) btn.click();
    });
    await page.waitForSelector("#btn-goto-equipment", { visible: true });
    await page.evaluate(() => {
        const btn = document.getElementById("btn-goto-equipment");
        if (btn) btn.click();
    });

    // In Equipment Screen, click "Back" to go to Setup
    await page.waitForSelector("#screen-equipment .back-button", { visible: true });
    await page.evaluate(() => {
        const btn = document.querySelector("#screen-equipment .back-button") as HTMLElement;
        if (btn) btn.click();
    });

    // 2.5 Click Launch Mission on Setup screen
    await page.waitForSelector("#btn-launch-mission");
    await page.evaluate(() => {
        const btn = document.getElementById("btn-launch-mission");
        if (btn) btn.click();
    });

    // 2.6 Handle Deployment
    await page.waitForSelector("#btn-autofill-deployment");
    await page.click("#btn-autofill-deployment");
    await page.click("#btn-start-mission");

    // Wait for mission screen
    await page.waitForSelector("#screen-mission");
    await page.waitForSelector("#top-bar", { visible: true });

    // Verify drawers are initially hidden (translated off-screen)
    const drawersStateInitial = await page.evaluate(() => {
      const squad = document.getElementById("soldier-panel");
      const right = document.getElementById("right-panel");
      if (!squad || !right) return null;

      const squadStyle = window.getComputedStyle(squad);
      const rightStyle = window.getComputedStyle(right);

      return {
        squadActive: squad.classList.contains("active"),
        rightActive: right.classList.contains("active"),
      };
    });

    expect(drawersStateInitial?.squadActive).toBe(false);
    expect(drawersStateInitial?.rightActive).toBe(false);

    // Toggle Squad Drawer
    await page.click("#btn-toggle-squad");
    await page.waitForSelector("#soldier-panel.active");

    const squadActiveState = await page.evaluate(() => {
      const squad = document.getElementById("soldier-panel");
      return squad?.classList.contains("active");
    });
    expect(squadActiveState).toBe(true);

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

    // Click game container (canvas) to close all drawers
    await page.evaluate(() => {
        const el = document.getElementById("game-canvas");
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
  });
});
