import { expect, test } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import { E2E_URL } from "./config";
import type { Page } from "puppeteer";

test("Replay Mission button works and starts a fresh mission", async () => {
  const page: Page = await getNewPage();

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  try {
    // 0. Clear local storage before starting
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.goto(E2E_URL);

    // 1. Start Custom Mission
    console.log("Waiting for splash to finish...");
    await new Promise(r => setTimeout(r, 2500)); // Wait for splash animation (1.8s)

    console.log("Navigating to Custom Mission Setup...");
    await page.waitForSelector("#btn-menu-custom", { visible: true });
    await page.click("#btn-menu-custom");
    
    await page.waitForSelector("#screen-mission-setup", { visible: true, timeout: 10000 });

    // Use a small map for speed
    await page.evaluate(() => {
        const wInput = document.getElementById("map-width") as HTMLInputElement;
        const hInput = document.getElementById("map-height") as HTMLInputElement;
        const spInput = document.getElementById("map-spawn-points") as HTMLInputElement;
        if (wInput) wInput.value = "6";
        if (hInput) hInput.value = "6";
        if (spInput) spInput.value = "1";
        wInput?.dispatchEvent(new Event("change"));
        spInput?.dispatchEvent(new Event("change"));
    });

    // Wait for squad builder to be ready
    console.log("Waiting for squad builder...");
    await page.waitForSelector(".soldier-card", { visible: true, timeout: 10000 });

    console.log("Launching Mission...");
    await page.waitForSelector("#btn-launch-mission", { visible: true });
    await page.click("#btn-launch-mission");
    
    // Handle Deployment Phase
    console.log("Handling Deployment Phase...");
    await page.waitForSelector("#btn-autofill-deployment", { visible: true, timeout: 10000 });
    await page.click("#btn-autofill-deployment");
    await new Promise(r => setTimeout(r, 500));
    await page.click("#btn-start-mission");

    console.log("Waiting for Mission to start...");
    await page.waitForSelector("#soldier-list", { visible: true, timeout: 10000 });

    // 2. Win the mission immediately via debug
    console.log("Winning Mission via Debug...");
    await page.keyboard.press("Backquote"); // Toggle debug
    await page.waitForSelector("#btn-force-win", { visible: true });
    await page.click("#btn-force-win");

    // 3. Wait for Debrief Screen
    console.log("Waiting for Debrief Screen...");
    await page.waitForSelector("#screen-debrief", { visible: true, timeout: 10000 });
    
    // Wait for replay to play a bit
    console.log("Waiting for Replay to play...");
    await new Promise(r => setTimeout(r, 2000));

    // Verify Replay Mission button is present
    const replayBtn = await page.waitForSelector('xpath///button[contains(text(), "Replay Mission")]');
    expect(replayBtn).not.toBeNull();

    // 4. Click Replay Mission
    console.log("Clicking Replay Mission...");
    await replayBtn!.click();

    // 5. Verify Mission Screen is visible and NOT frozen
    console.log("Waiting for Mission Screen to relaunch...");
    await page.waitForSelector("#screen-mission", { visible: true, timeout: 10000 });
    
    // Handle Deployment Phase AGAIN (after Replay Mission)
    console.log("Handling Deployment Phase (Second time)...");
    await page.waitForSelector("#btn-autofill-deployment", { visible: true, timeout: 10000 });
    await page.click("#btn-autofill-deployment");
    await new Promise(r => setTimeout(r, 500));
    await page.click("#btn-start-mission");

    console.log("Waiting for Mission to start (Second time)...");
    await page.waitForSelector("#soldier-list", { visible: true, timeout: 10000 });

    // Wait a bit for state to settle
    await new Promise(r => setTimeout(r, 2000));

    // Check if time is moving
    const timeValue = await page.$eval(".time-value", (el) => el.textContent);
    console.log("Initial Time:", timeValue);
    
    // Wait another second and check if time progressed
    await new Promise(r => setTimeout(r, 2000));
    const timeValue2 = await page.$eval(".time-value", (el) => el.textContent);
    console.log("Time after 2s:", timeValue2);
    
    const t1 = parseFloat(timeValue || "0");
    const t2 = parseFloat(timeValue2 || "0");
    console.log(`t1: ${t1}, t2: ${t2}`);
    
    expect(t2).toBeGreaterThan(t1);
    
    // Take a screenshot for visual confirmation
    await page.screenshot({ path: "screenshots/replay_mission_verified.png" });
  } catch (e) {
    console.error("Test failed:", e);
    await page.screenshot({ path: "screenshots/replay_mission_failure.png" });
    throw e;
  } finally {
    await closeBrowser();
  }
}, 120000);
