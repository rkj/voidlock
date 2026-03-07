import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Regression 1gudy: Tutorial Disabled Setting", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    // Use desktop viewport
    await page.setViewport({ width: 1024, height: 768 });
    page.on("console", msg => {
      if (msg.type() === "error" || msg.type() === "warn") {
         console.log(`BROWSER ${msg.type().toUpperCase()}:`, msg.text());
      }
    });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should skip prologue and unlock armory when tutorial is disabled", async () => {
    await page.goto(E2E_URL);
    await page.waitForFunction(() => (window as any).__VOIDLOCK_READY__ === true);

    // 1. Clear state and go to Main Menu
    await page.evaluate(() => {
        localStorage.clear();
        window.location.hash = "#main-menu";
    });
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector('#screen-main-menu', { visible: true });

    // 2. Click "New Campaign"
    const newExpeditionBtn = await page.waitForSelector('#btn-menu-campaign');
    await newExpeditionBtn!.click();
    await page.waitForSelector('.campaign-setup-wizard', { visible: true });

    // 3. Ensure "Skip Tutorial Prologue" is checked
    const skipCheck = await page.waitForSelector('#campaign-skip-prologue');
    const isChecked = await page.evaluate((el: any) => el.checked, skipCheck);
    if (!isChecked) {
        // Use evaluate to click to avoid timing issues with atmospheric overlays if any
        await page.evaluate(() => {
            const el = document.getElementById('campaign-skip-prologue') as HTMLInputElement;
            if (el) {
                el.checked = true;
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }

    // 4. Click "Initialize Expedition"
    const startBtn = await page.waitForSelector('[data-focus-id="btn-start-campaign"]');
    await page.evaluate((el: any) => el.click(), startBtn);

    // 5. ASSERT: The game does NOT enter the prologue mission, but lands on the Sector Map
    await page.waitForSelector('#screen-campaign', { visible: true, timeout: 30000 });
    const currentHash = await page.evaluate(() => window.location.hash);
    expect(currentHash).toBe("#campaign");

    // 6. ASSERT: All CampaignShell tabs are enabled
    const tabs = await page.evaluate(() => {
        const tabList = Array.from(document.querySelectorAll('.shell-tab'));
        return tabList.map(t => ({
            id: t.getAttribute('data-id'),
            // check both disabled attribute and class
            disabled: (t as any).disabled || t.hasAttribute('disabled') || t.classList.contains('disabled')
        }));
    });
    
    // Check key tabs exist and are enabled
    const engineeringTab = tabs.find(t => t.id === 'engineering');
    const statisticsTab = tabs.find(t => t.id === 'stats');
    const settingsTab = tabs.find(t => t.id === 'settings');

    expect(engineeringTab).toBeDefined();
    expect(engineeringTab?.disabled).toBeFalsy();
    
    expect(statisticsTab).toBeDefined();
    expect(statisticsTab?.disabled).toBeFalsy();
    
    expect(settingsTab).toBeDefined();
    expect(settingsTab?.disabled).toBeFalsy();

    // 7. Navigate to the first mission node and complete it
    // Wait for sector map to render
    const accessibleNode = await page.waitForSelector('.campaign-node.accessible', { visible: true });
    await page.evaluate((el: any) => el.click(), accessibleNode);

    // Should go to Mission Setup/Equipment Screen
    await page.waitForSelector('#screen-equipment', { visible: true });

    // Roster should have soldiers
    await page.waitForSelector('.soldier-widget-roster', { visible: true });
    
    // Quick deploy soldier if needed
    await page.evaluate(() => {
        const widget = document.querySelector('.soldier-widget-roster') as HTMLElement;
        if (widget) widget.click();
    });

    // Launch Mission (Tactical)
    const tacticalLaunchBtn = await page.waitForSelector('[data-focus-id="btn-launch-mission"]:not([disabled])');
    await page.evaluate((el: any) => el.click(), tacticalLaunchBtn);

    // Handle Deployment
    await page.waitForSelector('#screen-mission', { visible: true });
    await page.waitForSelector('#btn-autofill-deployment', { visible: true });
    await page.evaluate(() => {
        const btn = document.getElementById("btn-autofill-deployment");
        if (btn) btn.click();
    });
    await page.waitForSelector('#btn-start-mission:not([disabled])', { visible: true });
    await page.evaluate(() => {
        const btn = document.getElementById("btn-start-mission");
        if (btn) btn.click();
    });

    // 8. Force Win to complete mission
    console.log("Forcing win...");
    await page.evaluate(() => {
        const client = (window as any).GameAppInstance?.registry.gameClient;
        if (client) {
            client.applyCommand({ type: "DEBUG_FORCE_WIN" });
        }
    });

    // Wait for Debrief Screen
    console.log("Waiting for debrief screen...");
    await page.waitForSelector('#screen-debrief', { visible: true, timeout: 30000 });
    
    // Click "Return to Command Bridge"
    console.log("Clicking return to command bridge...");
    await page.evaluate(async () => {
        const buttons = Array.from(document.querySelectorAll('.debrief-button'));
        const continueBtn = buttons.find(b => b.textContent?.includes('Return')) as HTMLElement;
        if (continueBtn) {
            continueBtn.click();
        } else {
            console.error("Return button NOT FOUND in debrief");
        }
    });

    // Should return to Equipment Screen (Mission 2 flow) or Sector Map
    console.log("Waiting for screen after debrief...");
    await page.waitForFunction(() => {
        return document.getElementById('screen-equipment')?.style.display === 'flex' || 
               document.getElementById('screen-campaign')?.style.display === 'flex';
    }, { timeout: 30000 });

    const isEquipmentVisible = await page.evaluate(() => document.getElementById('screen-equipment')?.style.display === 'flex');
    console.log("Is equipment visible?", isEquipmentVisible);

    if (isEquipmentVisible) {
        // 9. ASSERT: The Armory/Equipment Store tab is NOT locked
        console.log("Checking if Armory is locked...");
        const isArmoryLocked = await page.evaluate(() => {
            const storeTab = document.querySelector('.armory-tab[data-tab="store"]');
            // If the tab system changed, check for the locked message
            const lockedMsg = document.querySelector('.locked-store-message');
            if (lockedMsg) return true;

            if (!storeTab) {
                // If tabs are used in SoldierInspector, check there
                const inspectorStoreTab = document.querySelector('.inspector-tab[data-tab="armory"]');
                if (inspectorStoreTab && inspectorStoreTab.classList.contains('locked')) return true;
                return false; // Assume not locked if no indicators found
            }
            return storeTab.classList.contains('locked') || storeTab.querySelector('.lock-icon') !== null;
        });
        expect(isArmoryLocked).toBe(false);

        // ASSERT: All CampaignShell tabs are enabled
        const tabsAfter = await page.evaluate(() => {
            const tabList = Array.from(document.querySelectorAll('.shell-tab'));
            return tabList.map(t => ({
                id: t.getAttribute('data-id'),
                disabled: (t as any).disabled || t.hasAttribute('disabled') || t.classList.contains('disabled')
            }));
        });

        expect(tabsAfter.find(t => t.id === 'engineering')?.disabled).toBeFalsy();
        expect(tabsAfter.find(t => t.id === 'stats')?.disabled).toBeFalsy();
        expect(tabsAfter.find(t => t.id === 'settings')?.disabled).toBeFalsy();

        // 10. Click "Back" to go to Sector Map
        console.log("Clicking back to sector map...");
        const backBtn = await page.waitForSelector('[data-focus-id="btn-back"]');
        await page.evaluate((el: any) => el.click(), backBtn);
        await page.waitForSelector('#screen-campaign', { visible: true });
    } else {
        // Already at sector map
        await page.waitForSelector('#screen-campaign', { visible: true });
    }

    // 11. ASSERT: No TutorialManager overlay or Advisor prompt
    console.log("Checking for Advisor...");
    const hasAdvisor = await page.evaluate(() => {
        const advisor = document.querySelector('.advisor-overlay');
        return advisor && advisor.classList.contains('active');
    });
    expect(hasAdvisor).toBeFalsy();

    // Take screenshots for proof
    await page.screenshot({ path: "tests/e2e/screenshots/regression_1gudy_tutorial_disabled_desktop.png" });
    await page.setViewport({ width: 400, height: 800 });
    await page.screenshot({ path: "tests/e2e/screenshots/regression_1gudy_tutorial_disabled_mobile.png" });
  });
});
