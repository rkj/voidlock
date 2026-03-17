import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Identity Spec: Abort Operation Label Regression (voidlock-mmbd9)", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
  });

  afterAll(async () => {
    await closeBrowser();
  });

  const enterMission = async () => {
    await page.goto(E2E_URL, { waitUntil: "load" });

    // 1. Navigate to Custom Mission
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");

    // 2. Wait for Mission Setup screen
    await page.waitForSelector("#screen-mission-setup");
    await page.waitForSelector("#btn-launch-mission", { visible: true });

    // Ensure squad is not empty to launch mission. If empty, click Auto-Fill
    const squadEmpty = await page.evaluate(() => {
        const slots = document.querySelectorAll("#squad-slots .unit-slot:not(.empty)");
        return slots.length === 0;
    });
    if (squadEmpty) {
        const firstRosterUnit = await page.$("#roster-grid .soldier-item");
        if (firstRosterUnit) {
            // Very simple click to select for deployment if needed, but normally E2E has 4 units in roster.
            await page.evaluate(() => {
                const btn = document.querySelector("#roster-grid .soldier-item") as HTMLElement;
                if (btn) btn.click();
            });
        }
    }

    // Give it a moment, click launch
    await new Promise(r => setTimeout(r, 500));
    await page.click("#btn-launch-mission");

    // 3. Wait for mission to load (deployment phase)
    await page.waitForSelector("#screen-mission", { visible: true });
    
    // Auto-fill deployment to start
    await page.waitForSelector("#btn-auto-deploy", { visible: true, timeout: 5000 }).catch(() => {});
    const autoDeployBtn = await page.$("#btn-auto-deploy");
    if (autoDeployBtn) {
        await page.click("#btn-auto-deploy");
        await new Promise(r => setTimeout(r, 500));
        await page.click("#btn-start-mission");
    }
    
    await page.waitForSelector("#top-bar", { visible: true });
  };

  it("should show 'Abort Operation' on desktop (1920x1080)", async () => {
    await page.setViewport({ width: 1920, height: 1080 });
    await enterMission();
    
    await page.waitForSelector("#btn-give-up", { visible: true });
    const text = await page.$eval("#btn-give-up", el => el.textContent?.trim());
    expect(text).toBe("Abort Operation");
    
    await page.screenshot({ path: "tests/e2e/__snapshots__/voidlock-mmbd9_desktop.png" });
  }, 60000);

  it("should show 'Abort Operation' on mobile (390x844)", async () => {
    await page.setViewport({ width: 390, height: 844 });
    await enterMission();
    
    // Open right drawer to see mission controls
    await page.waitForSelector("#btn-toggle-right", { visible: true });
    await page.click("#btn-toggle-right");
    await new Promise(r => setTimeout(r, 1000)); // wait for drawer animation
    
    await page.waitForSelector(".mobile-abort-button", { visible: true });
    const text = await page.$eval(".mobile-abort-button", el => el.textContent?.trim());
    expect(text).toBe("Abort Operation");
    
    await page.screenshot({ path: "tests/e2e/__snapshots__/voidlock-mmbd9_mobile.png" });
  }, 60000);
});
