import { describe, it, expect, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import { E2E_URL } from "./config";
import { KnownDevices } from "puppeteer";

describe("Mobile Full Campaign Flow", () => {
  afterAll(async () => {
    await closeBrowser();
  });

  it("should go through a full mission flow on mobile", async () => {
    const page = await getNewPage();
    await page.emulate(KnownDevices["iPhone 12"]);
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 1. Start Campaign
    await page.waitForSelector("#btn-menu-campaign");
    await page.click("#btn-menu-campaign");

    const startBtnSelector = ".campaign-setup-wizard .primary-button";
    await page.waitForSelector(startBtnSelector);
    await page.click(startBtnSelector);

    // 2. We should be on Sector Map. Check if tabs are visible.
    await page.waitForSelector(".campaign-node.accessible");

    // Check for Barracks tab
    const barracksTab = await page.evaluateHandle(() => {
      const tabs = Array.from(document.querySelectorAll(".tab-button"));
      return tabs.find((t) => t.textContent?.includes("Barracks"));
    });
    expect(barracksTab).toBeTruthy();

    // 3. Select first node
    await page.click(".campaign-node.accessible");

    // 4. Equipment Screen
    await page.waitForSelector("#screen-equipment");

    // Confirm Squad
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

    // 6. Deployment Phase
    await page.waitForSelector("#screen-mission");
    await page.waitForSelector(".deployment-unit-item");

    // Deploy all units
    const units = await page.$$(".deployment-unit-item");
    for (const unit of units) {
      await unit.click();
      await new Promise((r) => setTimeout(r, 100));
    }

    const startMissionBtn = await page.waitForSelector("#btn-start-mission");
    await startMissionBtn?.click();

    // 7. Playing state
    await page.waitForSelector(".command-menu");
    const menuItems = await page.$$(".menu-item");
    expect(menuItems.length).toBeGreaterThan(0);

    // Enable debug overlay to see Force Win button
    await page.keyboard.press("Backquote");

    // Toggle drawers to verify they work during mission
    await page.click("#btn-toggle-squad");
    await page.waitForSelector("#soldier-panel.active");

    await page.click("#btn-toggle-right");
    await page.waitForSelector("#right-panel.active");
    await new Promise((r) => setTimeout(r, 500)); // Wait for drawer transition
    await page.waitForSelector("#soldier-panel:not(.active)");

    // 8. Force Win (via Debug Tools in Right Panel)
    await page.waitForSelector("#btn-force-win", {
      visible: true,
      timeout: 5000,
    });
    await page.click("#btn-force-win");

    // 9. Debrief Screen
    await page.waitForSelector(".debrief-screen", {
      visible: true,
      timeout: 10000,
    });

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll(".debrief-button"));
      const btn = buttons.find(
        (b) =>
          b.textContent?.includes("Return to Command Bridge") ||
          b.textContent?.includes("Continue"),
      );
      if (btn) (btn as HTMLElement).click();
      else throw new Error("Continue button not found on Debrief Screen");
    });

    // 10. Should be back on Sector Map
    await page.waitForSelector("#screen-campaign-shell");
  });
});