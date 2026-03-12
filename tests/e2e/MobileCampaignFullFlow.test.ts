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
    page.on("console", msg => console.log("BROWSER:", msg.text()));
    await page.emulate(KnownDevices["iPhone 12"]);
    await page.goto(E2E_URL, { waitUntil: "load" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "load" });
    
    // Wait for App to be ready
    await page.waitForFunction(() => (window as any).__VOIDLOCK_READY__ === true);

    // 1. Start Campaign
    await page.waitForSelector("#btn-menu-campaign");
    await page.evaluate(() => {
        const btn = document.getElementById("btn-menu-campaign");
        if (btn) btn.click();
    });

    const startBtnSelector = ".campaign-setup-wizard .primary-button";
    await page.waitForSelector(startBtnSelector);

    // Skip Tutorial Prologue to reach Sector Map
    await page.evaluate(() => {
        const check = document.getElementById("campaign-skip-prologue") as HTMLInputElement;
        if (check) check.click();
    });

    await page.evaluate((sel) => {
        const btn = document.querySelector(sel) as HTMLElement;
        if (btn) btn.click();
    }, startBtnSelector);

    // 2. We should be on Sector Map. Check if tabs are visible.
    await page.waitForSelector(".campaign-node.accessible");

    // Check for Asset Management Hub tab (formerly Ready Room)
    const readyRoomTab = await page.evaluateHandle(() => {
      const tabs = Array.from(document.querySelectorAll(".tab-button"));
      return tabs.find((t) => t.textContent?.includes("Asset Management Hub"));
    });
    expect(readyRoomTab).toBeTruthy();

    // 3. Select first node
    await page.evaluate(() => {
        const node = document.querySelector(".campaign-node.accessible") as HTMLElement;
        if (node) node.click();
    });

    // 4. Equipment Screen
    await page.waitForSelector("#screen-equipment");

    // Launch Mission directly from Equipment screen in Campaign
    await page.waitForSelector('[data-focus-id="btn-launch-mission"]', { visible: true });
    await page.evaluate(() => {
        const btn = document.querySelector('[data-focus-id="btn-launch-mission"]') as HTMLElement;
        if (btn) btn.click();
    });

    // 6. Mission Phase (Deployment or Playing)
    await page.waitForSelector("#screen-mission", { visible: true });

    // Wait for mission state to be initialized
    await page.waitForFunction(() => {
        const app = (window as any).GameAppInstance;
        const state = app?.registry?.missionRunner?.getCurrentGameState();
        return state && (state.status === "Deployment" || state.status === "Playing");
    }, { timeout: 10000 });

    const status = await page.evaluate(() => {
        const app = (window as any).GameAppInstance;
        return app.registry.missionRunner.getCurrentGameState().status;
    });

    if (status === "Deployment") {
        await page.waitForSelector(".deployment-unit-item");

        // Deploy all units
        const units = await page.$$(".deployment-unit-item");
        for (const unit of units) {
          await unit.click({ clickCount: 2 });
          await new Promise((r) => setTimeout(r, 500));
        }

        const startMissionBtn = await page.waitForSelector("#btn-start-mission");
        await startMissionBtn?.click();
    } else {
        console.log("Directly in Playing Phase (likely Prologue), skipping deployment steps.");
        // If advisor is showing blocking message, click Continue
        const advisorBtn = await page.$(".advisor-btn");
        if (advisorBtn) {
            await advisorBtn.click();
            await new Promise(r => setTimeout(r, 500));
        }
    }

    // 7. Playing state
    // On mobile, we need to select a unit to see the command menu.
    // Open squad panel drawer first
    await page.click("#btn-toggle-squad");
    await page.waitForSelector("#soldier-panel.active");
    await new Promise(r => setTimeout(r, 500)); // Wait for transition
    
    // Click first soldier card to select
    await page.waitForSelector(".soldier-item");
    const clickResult = await page.evaluate(() => {
        const item = document.querySelector(".soldier-item") as HTMLElement;
        if (!item) return "not_found";
        const style = window.getComputedStyle(item);
        const rect = item.getBoundingClientRect();
        const parent = item.parentElement;
        const parentStyle = parent ? window.getComputedStyle(parent) : null;
        
        const info = {
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
            rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
            parentDisplay: parentStyle?.display,
            parentVisible: parent ? (parent as HTMLElement).offsetParent !== null : false
        };
        
        item.click();
        return info;
    });

    await page.waitForSelector(".command-menu");
    const menuItems = await page.$$(".menu-item");
    expect(menuItems.length).toBeGreaterThan(0);

    // Enable debug overlay to see Force Win button
    await page.evaluate(() => {
        const app = (window as any).GameAppInstance;
        if (app && app.registry && app.registry.gameClient) {
            app.registry.gameClient.toggleDebugOverlay(true);
        }
    });

    // Toggle drawers to verify they work during mission
    // (If squad panel is already active from step 7, this will close it)
    await page.click("#btn-toggle-squad");
    
    await page.click("#btn-toggle-right");
    await page.waitForSelector("#right-panel.active");
    await new Promise((r) => setTimeout(r, 500)); // Wait for drawer transition
    
    // On mobile, toggling right panel should deactivate soldier panel if it was active
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
          b.textContent?.includes("Return") ||
          b.textContent?.includes("Continue"),
      );
      if (btn) (btn as HTMLElement).click();
      else throw new Error("Continue button not found on Debrief Screen");
    });

    // 10. Should be back on Sector Map
    await page.waitForSelector("#screen-campaign-shell");
  });
});