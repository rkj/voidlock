import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Prologue Flow Reproduction", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 800, height: 600 });
    // page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    // Disable animations and splash to save memory/time
    await page.addStyleTag({ content: `
      * { transition: none !important; animation: none !important; }
      #screen-main-menu.title-splash-active .main-menu-content { opacity: 1 !important; transform: none !important; pointer-events: auto !important; }
      .title-splash { display: none !important; }
    `});
  }, 30000);

  afterAll(async () => {
    await closeBrowser();
  });

  it("should demonstrate overwhelming prologue UI and redundant flow", async () => {
    console.log("Starting test...");
    await page.goto(E2E_URL);
    
    // 1. Wait for app readiness
    console.log("Waiting for app instance...");
    await page.waitForFunction(() => !!window.GameAppInstance);
    
    // 2. Click "Campaign" on Main Menu
    console.log("Clicking Campaign...");
    const campaignBtn = "#btn-menu-campaign";
    await page.waitForSelector(campaignBtn, { visible: true });
    await page.click(campaignBtn);

    // Wait for transition
    await new Promise(r => setTimeout(r, 2000));
    const visibleScreens = await page.evaluate(() => {
        return Array.from(document.querySelectorAll(".screen"))
            .filter(el => (el as HTMLElement).style.display === "flex")
            .map(el => el.id);
    });
    console.log("Visible screens after clicking Campaign:", visibleScreens);

    // Diagnostic screenshot
    console.log("Taking diagnostic screenshot after clicking Campaign...");
    await page.screenshot({ path: "tests/e2e/__snapshots__/debug_after_campaign_click.png" });

    // 3. Start campaign via Wizard
    console.log("Starting campaign via Wizard...");
    const startBtn = "[data-focus-id='btn-start-campaign']";
    await page.waitForSelector(startBtn, { visible: true });
    await page.evaluate((sel) => {
        const btn = document.querySelector(sel) as HTMLElement;
        if (btn) btn.click();
    }, startBtn);

    // 4. Verify we land on Equipment Screen (ADR 0049: Skip Sector Map)
    console.log("Verifying Equipment Screen...");
    await page.waitForSelector("#screen-equipment", { visible: true });
    const currentHash = await page.evaluate(() => window.location.hash);
    expect(currentHash).toBe("#equipment");

    // 5. Verify redundant buttons are GONE (Bug: Should NOT have "Confirm Squad" / "Back")
    console.log("Checking that Back button is hidden...");
    const backBtn = await page.$("[data-focus-id='btn-back']");
    expect(backBtn).toBeNull();

    const launchBtn = await page.$("[data-focus-id='btn-launch-mission']");
    expect(launchBtn).not.toBeNull();

    // 6. Verify non-essential tabs are HIDDEN (Bug: Should be hidden)
    console.log("Checking for non-essential tabs...");
    const sectorMapTab = await page.$(".shell-tab[data-id='sector-map']");
    const engineeringTab = await page.$(".shell-tab[data-id='engineering']");
    const statsTab = await page.$(".shell-tab[data-id='stats']");
    const settingsTab = await page.$(".shell-tab[data-id='settings']");

    expect(sectorMapTab).toBeNull();
    expect(engineeringTab).toBeNull();
    expect(statsTab).toBeNull();
    expect(settingsTab).toBeNull();

    const readyRoomTab = await page.$(".shell-tab[data-id='ready-room']");
    expect(readyRoomTab).not.toBeNull();

    // 7. Verify squad size is exactly 1
    console.log("Verifying squad size...");
    const occupiedSlots = await page.$$(".soldier-list-panel .soldier-item");
    expect(occupiedSlots.length).toBe(1);

    // 8. Final screenshot for proof
    console.log("Taking final screenshot...");
    await page.screenshot({ path: "tests/e2e/__snapshots__/prologue_guided_flow_verified.png" });
    console.log("Test finished.");
  });
});
