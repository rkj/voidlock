import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Tutorial Input Gating Regression (voidlock-26y0x.8)", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
    page.on('pageerror', error => {
        console.log(`BROWSER ERROR: ${error.message}`);
        console.log(`BROWSER ERROR STACK: ${error.stack}`);
    });
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should complete the full tutorial flow without SELECT_UNIT being blocked", async () => {
    const stepOrder = ["observe", "ui_tour", "pause", "doors", "combat", "engagement_ignore", "engagement_engage", "move", "pickup", "extract"];

    await page.goto(E2E_URL);
    await page.waitForSelector("#screen-main-menu.title-splash-complete", { timeout: 15000 });

    // 1. Initialize Expedition
    await page.click("#btn-menu-campaign");
    await page.waitForSelector(".campaign-setup-wizard");
    await page.click(".campaign-setup-wizard .primary-button");

    // 2. Launch from Equipment Screen
    await page.waitForSelector("#screen-equipment", { visible: true });
    
    // Wait until start button is active
    await page.waitForFunction(() => {
        const btn = document.querySelector('[data-focus-id="btn-launch-mission"]') as HTMLButtonElement;
        return btn && !btn.disabled && btn.style.opacity !== "0.5";
    }, { timeout: 5000 });

    await page.click('[data-focus-id="btn-launch-mission"]');

    // 3. Dismiss Mission Briefing
    await page.waitForSelector(".advisor-message", { visible: true, timeout: 5000 });
    await page.click(".advisor-btn[data-id='dismiss']");
    await new Promise(r => setTimeout(r, 1000));

    // 4. Dismiss Operator Notice
    await page.waitForSelector(".advisor-message", { visible: true });
    await page.click(".advisor-btn[data-id='dismiss']");

    // 5. Unpause
    await page.waitForSelector("#btn-pause-toggle", { visible: true });
    const playText = await page.$eval("#btn-pause-toggle", el => (el as HTMLElement).innerText);
    if (playText.includes("Play")) {
        await page.click("#btn-pause-toggle");
    }

    // 6. Wait for mission body
    await page.waitForSelector("#mission-body", { visible: true, timeout: 15000 });

    // Helper to wait for a specific step or beyond
    const waitForStep = async (stepId: string, timeout = 60000) => {
        const targetIndex = stepOrder.indexOf(stepId);
        
        console.log(`Waiting for step: ${stepId} (index ${targetIndex})...`);
        await page.waitForFunction((id, order, index) => {
            const el = document.getElementById("tutorial-directive");
            const currentId = el?.getAttribute("data-step");
            if (!currentId) return false;
            const currentIndex = order.indexOf(currentId);
            return currentIndex >= index;
        }, { timeout }, stepId, stepOrder, targetIndex);
        console.log(`Reached step: ${stepId} (or beyond)`);
    };

    // Helper to dismiss a specific advisor message
    const dismissAdvisor = async (msgId: string) => {
        console.log(`Waiting for Advisor message: ${msgId}...`);
        await page.waitForSelector(`.advisor-modal-backdrop[data-msg-id='${msgId}']`, { visible: true, timeout: 15000 });
        await page.click(".advisor-btn[data-id='dismiss']");
        await page.waitForSelector(`.advisor-modal-backdrop[data-msg-id='${msgId}']`, { hidden: true, timeout: 5000 });
        console.log(`Dismissed Advisor message: ${msgId}`);
    };

    // Advance to "PAUSE" step (or beyond if unit moved fast)
    await waitForStep("pause");

    // 7. Pause step (Only if still in pause step)
    const isAtPause = await page.evaluate(() => document.getElementById("tutorial-directive")?.getAttribute("data-step") === "pause");
    if (isAtPause) {
        await page.click("#btn-pause-toggle");
    }

    // Advance to "IGNORE" step (doors and combat might be auto-skipped)
    console.log("Waiting for 'engagement_ignore' step or blocking advisor...");
    await page.waitForFunction((order, index) => {
        const el = document.getElementById("tutorial-directive");
        const currentId = el?.getAttribute("data-step");
        const advisorVisible = !!document.querySelector(".advisor-message");
        if (!currentId) return advisorVisible;
        const currentIndex = order.indexOf(currentId);
        return (currentIndex >= index) || advisorVisible;
    }, { timeout: 60000 }, stepOrder, 5);

    // Dismiss 'enemy_sighted' if it appeared
    const hasEnemySighted = await page.evaluate(() => !!document.querySelector(".advisor-modal-backdrop[data-msg-id='enemy_sighted']"));
    if (hasEnemySighted) {
        await dismissAdvisor("enemy_sighted");
    }

    // Now wait for 'engagement_ignore' specifically (it has its own message 'first_command')
    await waitForStep("engagement_ignore");

    // Dismiss 'first_command' (from engagement_ignore step)
    await dismissAdvisor("first_command");

    // 10. Engagement > Ignore > Unit 1
    const isAtIgnore = await page.evaluate(() => document.getElementById("tutorial-directive")?.getAttribute("data-step") === "engagement_ignore");
    if (isAtIgnore) {
        await page.keyboard.press("2"); // Engagement
        await new Promise(r => setTimeout(r, 500));
        await page.keyboard.press("2"); // Ignore
        await new Promise(r => setTimeout(r, 500));
        await page.keyboard.press("1"); // Unit 1
    }

    // Advance to "RE-AUTHORIZE" step
    await waitForStep("engagement_engage");

    // 10. Engagement > Engage > Unit 1
    const isAtEngage = await page.evaluate(() => document.getElementById("tutorial-directive")?.getAttribute("data-step") === "engagement_engage");
    if (isAtEngage) {
        await page.keyboard.press("2"); // Engagement
        await new Promise(r => setTimeout(r, 500));
        await page.keyboard.press("1"); // Engage
        await new Promise(r => setTimeout(r, 500));
        await page.keyboard.press("1"); // Unit 1
    }

    // Wait for Move step
    await waitForStep("move");

    // Dismiss 'objective_sighted'
    await dismissAdvisor("objective_sighted");

    // 11. Move > Select Room > Select Unit
    await page.keyboard.press("1"); // Orders
    await new Promise(r => setTimeout(r, 500));
    await page.keyboard.press("1"); // Move to Room
    await new Promise(r => setTimeout(r, 500));
    await page.keyboard.press("1"); // First room
    await new Promise(r => setTimeout(r, 500));
    await page.keyboard.press("1"); // Unit 1

    // Wait for Pickup step
    await waitForStep("pickup");

    // 12. Pickup > Unit 1
    await page.keyboard.press("4"); // Pickup
    await new Promise(r => setTimeout(r, 1000));
    
    // Log available items for debug
    const itemsHtml = await page.evaluate(() => document.getElementById("command-menu")?.innerHTML);
    console.log("Command menu HTML during pickup:", itemsHtml);

    // Dynamically find the key for 'Data Disk' or 'Objective'
    const diskKey = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll(".command-item"));
        const diskItem = items.find(el => {
            const text = (el as HTMLElement).innerText.toUpperCase();
            return text.includes("DISK") || text.includes("OBJECTIVE") || text.includes("INTEL");
        });
        return diskItem?.getAttribute("data-index") || "1";
    });
    console.log(`Selecting disk with key: ${diskKey}`);
    await page.keyboard.press(diskKey);
    await new Promise(r => setTimeout(r, 500));
    await page.keyboard.press("1"); // Unit 1

    // Wait for Extract step
    await waitForStep("extract");

    // Dismiss 'objective_completed'
    await dismissAdvisor("objective_completed");

    // 13. Select Unit then Extract
    await page.click(".soldier-card");
    await new Promise(r => setTimeout(r, 500));
    await page.keyboard.press("5"); // Extract
    await new Promise(r => setTimeout(r, 500));
    await page.keyboard.press("1"); // Unit 1

    // Wait for Mission Win
    await page.waitForSelector("#screen-debrief", { visible: true, timeout: 60000 });
  }, 180000); // 3 minutes timeout for full mission
});
