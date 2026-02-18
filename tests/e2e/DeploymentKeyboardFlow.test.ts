import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Mission Deployment Keyboard Flow", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1280, height: 800 });
    page.on("console", (msg) => console.log("BROWSER:", msg.text()));
    
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  }, 30000);

  afterAll(async () => {
    await closeBrowser();
  });

  const pressTab = async (count: number = 1) => {
    for (let i = 0; i < count; i++) {
      await page.keyboard.press("Tab");
      await new Promise(r => setTimeout(r, 100));
    }
  };

  const pressEnter = async () => {
    await page.keyboard.press("Enter");
    await new Promise(r => setTimeout(r, 500));
  };

  const getActiveElementInfo = async () => {
    return await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      return {
        tagName: el.tagName,
        id: el.id,
        className: el.className,
        textContent: el.textContent?.trim(),
        ariaLabel: el.getAttribute("aria-label")
      };
    });
  };

  it("should deploy units and start mission using only keyboard", async () => {
    await page.goto(E2E_URL);
    await page.waitForSelector("#btn-menu-custom");

    // 1. Enter Custom Mission Setup
    console.log("Entering Custom Mission Setup...");
    // Main menu should have btn-menu-campaign focused, Tab once to custom
    await pressTab(); 
    const active = await getActiveElementInfo();
    if (active?.id !== "btn-menu-custom") {
        // Try to find it manually via Tab if auto-focus failed
        for (let i = 0; i < 5; i++) {
            if ((await getActiveElementInfo())?.id === "btn-menu-custom") break;
            await pressTab();
        }
    }
    await pressEnter();
    await page.waitForSelector("#screen-mission-setup", { visible: true });

    // 2. Enable Manual Deployment
    console.log("Enabling Manual Deployment...");
    let foundDeploymentToggle = false;
    for (let i = 0; i < 30; i++) {
      const active = await getActiveElementInfo();
      if (active?.id === "toggle-manual-deployment") {
        foundDeploymentToggle = true;
        break;
      }
      await pressTab();
    }
    expect(foundDeploymentToggle, "Failed to find 'Deployment' toggle").toBe(true);
    
    // Check if it's already checked
    const isChecked = await page.evaluate(() => {
        const active = document.activeElement as HTMLInputElement;
        return active.checked;
    });

    if (!isChecked) {
        console.log("Enabling Manual Deployment...");
        await page.keyboard.press("Space");
    } else {
        console.log("Manual Deployment already enabled.");
    }

    // 3. Go to Equipment Screen
    console.log("Navigating to Equipment Screen...");
    let foundEquipmentBtn = false;
    for (let i = 0; i < 20; i++) {
      const active = await getActiveElementInfo();
      if (active?.id === "btn-goto-equipment") {
        foundEquipmentBtn = true;
        break;
      }
      await pressTab();
    }
    expect(foundEquipmentBtn, "Failed to find 'Equipment & Supplies' button").toBe(true);
    await pressEnter();
    await page.waitForSelector(".equipment-screen", { visible: true });

    // 4. Add a soldier to the squad
    console.log("Adding soldier to squad...");
    // Slots are empty, right panel shows roster
    // Tab to find a roster item (SoldierWidget in roster context has .clickable)
    let foundRosterItem = false;
    for (let i = 0; i < 20; i++) {
      const active = await getActiveElementInfo();
      if (active?.className.includes("clickable") && active?.className.includes("soldier-widget-roster")) {
        foundRosterItem = true;
        break;
      }
      await pressTab();
    }
    expect(foundRosterItem, "Failed to find a roster item to add").toBe(true);
    await pressEnter();

    // 5. Confirm Squad
    console.log("Confirming squad...");
    let foundConfirmBtn = false;
    for (let i = 0; i < 50; i++) {
      const active = await getActiveElementInfo();
      console.log(`Equipment Tab ${i}: <${active?.tagName}> id="${active?.id}" class="${active?.className}" text="${active?.textContent}"`);
      if (active?.textContent === "Confirm Squad") {
        foundConfirmBtn = true;
        break;
      }
      await pressTab();
    }
    expect(foundConfirmBtn, "Failed to find 'Confirm Squad' button").toBe(true);
    await pressEnter();
    await page.waitForSelector("#screen-mission-setup", { visible: true });

    // 5.5 Launch Mission
    console.log("Launching Mission...");
    let foundLaunchBtn = false;
    for (let i = 0; i < 50; i++) {
        const active = await getActiveElementInfo();
        console.log(`Setup Tab ${i}: <${active?.tagName}> id="${active?.id}" class="${active?.className}" text="${active?.textContent}"`);
        if (active?.id === "btn-launch-mission") {
            foundLaunchBtn = true;
            break;
        }
        await pressTab();
    }
    expect(foundLaunchBtn, "Failed to find 'Launch Mission' button").toBe(true);
    await pressEnter();

    // 6. Mission Deployment Phase
    console.log("Waiting for Mission Deployment Phase...");
    await page.waitForSelector(".deployment-summary", { visible: true });

    // 7. Verify deployment list is reachable via Tab
    console.log("Tabbing to deployment list...");
    let foundDeploymentItem = false;
    for (let i = 0; i < 20; i++) {
      const active = await getActiveElementInfo();
      console.log(`Deployment Tab ${i}: <${active?.tagName}> class="${active?.className}" text="${active?.textContent}"`);
      if (active?.className.includes("deployment-unit-item") && active?.className.includes("clickable")) {
        foundDeploymentItem = true;
        break;
      }
      await pressTab();
    }
    expect(foundDeploymentItem, "Failed to reach deployment unit item via Tab").toBe(true);

    // 8. Auto-deploy all units using Auto-Fill Spawns button
    console.log("Deploying all units via Auto-Fill Spawns...");
    let foundAutoFillBtn = false;
    for (let i = 0; i < 20; i++) {
        const active = await getActiveElementInfo();
        if (active?.id === "btn-autofill-deployment") {
            foundAutoFillBtn = true;
            break;
        }
        await pressTab();
    }
    expect(foundAutoFillBtn, "Failed to find 'Auto-Fill Spawns' button").toBe(true);
    await pressEnter();
    await new Promise(r => setTimeout(r, 1000));

    // 9. Reach Start Mission button
    console.log("Tabbing to 'Start Mission' button...");
    let foundStartBtn = false;
    for (let i = 0; i < 10; i++) {
      const active = await getActiveElementInfo();
      console.log(`StartBtn Tab ${i}: <${active?.tagName}> id="${active?.id}" class="${active?.className}" text="${active?.textContent}"`);
      if (active?.id === "btn-start-mission") {
        const isDisabled = await page.evaluate(() => (document.getElementById("btn-start-mission") as any).disabled);
        if (!isDisabled) {
            foundStartBtn = true;
            break;
        } else {
            console.log("Start Mission button found but still disabled...");
        }
      }
      await pressTab();
    }
    expect(foundStartBtn, "Failed to find ENABLED 'Start Mission' button").toBe(true);

    // 10. Start Mission
    console.log("Starting mission...");
    await pressEnter();
    
    // Verify mission started (Deployment UI should disappear)
    await page.waitForSelector(".deployment-summary", { hidden: true });
    console.log("Mission started successfully via keyboard!");
  }, 120000);
});
