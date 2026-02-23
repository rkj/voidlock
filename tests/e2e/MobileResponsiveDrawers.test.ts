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
    await page.goto(E2E_URL);

    // Navigate to mission
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");
    await page.waitForSelector("#btn-goto-equipment");
    await page.click("#btn-goto-equipment");

    // In Equipment Screen, click "Confirm Squad"
    await page.waitForSelector(".equipment-screen");
    const confirmBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll(".primary-button"));
      return buttons.find((b) => b.textContent === "Confirm Squad");
    });
    if (confirmBtn) {
      // @ts-ignore
      await confirmBtn.click();
    } else {
      throw new Error("Confirm Squad button not found");
    }

    // 2.5 Click Launch Mission on Setup screen
    await page.waitForSelector("#btn-launch-mission");
    await page.click("#btn-launch-mission");

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

    // Click game container to close all drawers
    await page.click("#game-container");

    // Wait for transition
    await new Promise((r) => setTimeout(r, 400));

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
