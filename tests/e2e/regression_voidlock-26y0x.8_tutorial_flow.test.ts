import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Tutorial Input Gating Regression (voidlock-26y0x.8)", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    page.on("console", msg => {
        console.log(`BROWSER ${msg.type().toUpperCase()}:`, msg.text());
    });
    page.on("pageerror", error => {
        console.log(`BROWSER ERROR:`, error.message);
    });
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should complete the full tutorial flow without SELECT_UNIT being blocked", async () => {
    await page.goto(E2E_URL);
    await page.waitForSelector("#screen-main-menu.title-splash-complete", { timeout: 10000 });

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

    // Advance to "PAUSE" step
    await page.waitForFunction(() => {
        const text = document.querySelector("#tutorial-directive-text")?.textContent || "";
        return text.toUpperCase().includes("PAUSE");
    }, { timeout: 60000 });

    // Press pause button to complete pause step
    await page.click("#btn-pause-toggle");
    await new Promise(r => setTimeout(r, 1000));
    
    // Resume to allow unit to reach door
    await page.click("#btn-pause-toggle");

    // Dismiss advisor
    await page.waitForSelector(".advisor-message", { visible: true });
    await page.click(".advisor-btn[data-id='dismiss']");

    // Wait for "INTERVENTION" (engagement_ignore) step
    try {
        await page.waitForFunction(() => {
            const text = (document.querySelector("#tutorial-directive-text")?.textContent || "").toUpperCase();
            return text.includes("INTERVENTION");
        }, { timeout: 30000 });
    } catch (e) {
        console.log("Stuck waiting for INTERVENTION. Current URL:", page.url());
        await page.screenshot({ path: "tests/e2e/__snapshots__/tutorial_stuck_intervention.png" });
        throw e;
    }

    let directiveText = await page.$eval("#tutorial-directive-text", el => (el as HTMLElement).innerText);
    expect(directiveText.toUpperCase()).toContain("INTERVENTION");

    // Dismiss 'first_command' advisor message
    await page.waitForSelector(".advisor-message", { visible: true });
    await page.click(".advisor-btn[data-id='dismiss']");

    // 9. Engagement > Ignore > Select Unit
    await page.keyboard.press("2"); // Engagement
    await new Promise(r => setTimeout(r, 500));
    await page.keyboard.press("2"); // Ignore
    await new Promise(r => setTimeout(r, 500));
    await page.keyboard.press("1"); // Unit 1
    
    // It should advance to Engagement Engage
    await page.waitForFunction(() => {
        const text = (document.querySelector("#tutorial-directive-text")?.textContent || "").toUpperCase();
        return text.includes("LOCKOUT");
    }, { timeout: 10000 });
    
    directiveText = await page.$eval("#tutorial-directive-text", el => (el as HTMLElement).innerText);
    expect(directiveText.toUpperCase()).toContain("LOCKOUT");

    // 10. Engagement > Engage > Select Unit
    await page.keyboard.press("2"); // Engagement
    await new Promise(r => setTimeout(r, 500));
    await page.keyboard.press("1"); // Engage
    await new Promise(r => setTimeout(r, 500));
    await page.keyboard.press("1"); // Unit 1

    // It should advance to Move step (after enemy dies)
    await page.waitForFunction(() => {
        const text = (document.querySelector("#tutorial-directive-text")?.textContent || "").toUpperCase();
        return text.includes("MOVE TO ROOM");
    }, { timeout: 30000 });

    directiveText = await page.$eval("#tutorial-directive-text", el => (el as HTMLElement).innerText);
    expect(directiveText.toUpperCase()).toContain("MOVE TO ROOM");

    // 11. Move > Select Room > Select Unit
    await page.keyboard.press("1"); // Orders
    await new Promise(r => setTimeout(r, 500));
    await page.keyboard.press("1"); // Move to Room
    await new Promise(r => setTimeout(r, 500));
    await page.keyboard.press("1"); // First room
    await new Promise(r => setTimeout(r, 500));
    await page.keyboard.press("1"); // Unit 1

    // Wait for Pickup step (once unit reaches room)
    await page.waitForFunction(() => {
        const text = (document.querySelector("#tutorial-directive-text")?.textContent || "").toUpperCase();
        return text.includes("PICKUP");
    }, { timeout: 45000 });

    // Dismiss advisor
    const hasAdvisor = await page.evaluate(() => !!document.querySelector(".advisor-message"));
    if (hasAdvisor) {
        await page.click(".advisor-btn[data-id='dismiss']");
    }

    directiveText = await page.$eval("#tutorial-directive-text", el => (el as HTMLElement).innerText);
    expect(directiveText.toUpperCase()).toContain("PICKUP");

    // 12. Pickup > Select Item > Select Unit
    // In objective room, there might be multiple items or just disk
    await page.keyboard.press("4"); // Pickup
    await new Promise(r => setTimeout(r, 500));
    await page.keyboard.press("1"); // First item
    await new Promise(r => setTimeout(r, 500));
    await page.keyboard.press("1"); // Unit 1

    // Wait for Extract step
    await page.waitForFunction(() => {
        const text = (document.querySelector("#tutorial-directive-text")?.textContent || "").toUpperCase();
        return text.includes("EXTRACT");
    }, { timeout: 30000 });

    const hasAdvisorExt = await page.evaluate(() => !!document.querySelector(".advisor-message"));
    if (hasAdvisorExt) {
        await page.click(".advisor-btn[data-id='dismiss']");
    }

    directiveText = await page.$eval("#tutorial-directive-text", el => (el as HTMLElement).innerText);
    expect(directiveText.toUpperCase()).toContain("EXTRACT");

    // 13. Extract
    await page.keyboard.press("5"); // Extract
    await new Promise(r => setTimeout(r, 500));
    await page.keyboard.press("1"); // Unit 1

    // Wait for Mission Win
    await page.waitForSelector("#screen-debrief", { visible: true, timeout: 45000 });
  }, 180000); // 3 minutes timeout for full mission
});
