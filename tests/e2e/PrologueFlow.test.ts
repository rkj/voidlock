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

    // 4. Verify we land on Sector Map (Bug: Should go directly to Ready Room)
    console.log("Verifying Sector Map...");
    await page.waitForSelector(".campaign-map-viewport", { visible: true });
    const currentHash = await page.evaluate(() => window.location.hash);
    expect(currentHash).toBe("#campaign");

    // 5. Click the first node (Prologue)
    console.log("Clicking Prologue node...");
    const nodeSelector = ".campaign-node.accessible";
    await page.waitForSelector(nodeSelector, { visible: true });
    await page.click(nodeSelector);

    // 6. Verify we are in Equipment Screen (Ready Room)
    console.log("Verifying Equipment Screen...");
    await page.waitForSelector("#screen-equipment", { visible: true });
    
    // 7. Verify redundant buttons (Bug: Should only have "Launch Mission")
    console.log("Checking for redundant buttons...");
    const confirmBtn = await page.$("[data-focus-id='btn-confirm-squad']");
    const launchBtn = await page.$("[data-focus-id='btn-launch-mission']");
    
    expect(confirmBtn).not.toBeNull();
    expect(launchBtn).not.toBeNull();

    const confirmText = await page.evaluate(el => el?.textContent, confirmBtn);
    expect(confirmText).toBe("Confirm Squad");

    // 8. Demonstrate redundant flow: Confirm Squad goes back to Map
    console.log("Clicking Confirm Squad...");
    await page.click("[data-focus-id='btn-confirm-squad']");
    await page.waitForSelector(".campaign-map-viewport", { visible: true });
    
    // 9. Verify overwhelming sliders: Go to "Setup" tab if it exists
    console.log("Checking for Setup tab...");
    // (Bug: Setup tab shouldn't exist in Campaign, and definitely not in Prologue)
    const setupTab = await page.$(".shell-tab[data-id='setup']");
    if (setupTab) {
        console.log("Setup tab found, clicking it...");
        await setupTab.click();
        await page.waitForSelector("#screen-mission-setup", { visible: true });
        
        // Verify sliders are present
        console.log("Verifying sliders...");
        const threatSlider = await page.$("#map-starting-threat");
        const baseEnemiesSlider = await page.$("#map-base-enemies");
        const growthSlider = await page.$("#map-enemy-growth");
        
        expect(threatSlider).not.toBeNull();
        expect(baseEnemiesSlider).not.toBeNull();
        expect(growthSlider).not.toBeNull();
    } else {
        console.log("Setup tab NOT found.");
    }

    // 10. Verify non-essential tabs are visible (Bug: Should be hidden)
    console.log("Checking for non-essential tabs...");
    const engineeringTab = await page.$(".shell-tab[data-id='engineering']");
    const statsTab = await page.$(".shell-tab[data-id='stats']");
    const settingsTab = await page.$(".shell-tab[data-id='settings']");

    expect(engineeringTab).not.toBeNull();
    expect(statsTab).not.toBeNull();
    expect(settingsTab).not.toBeNull();

    // 11. Final screenshot for proof
    console.log("Taking final screenshot...");
    await page.screenshot({ path: "tests/e2e/__snapshots__/prologue_repro_final.png" });
    console.log("Test finished.");
  });
});
