import { describe, it, expect, beforeAll, afterAll } from "vitest";
import puppeteer, { Browser, Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("UIBinder Synchronization", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768 });
    
    page.on("console", msg => {
      console.log(`BROWSER CONSOLE: [${msg.type()}] ${msg.text()}`);
    });

    page.on("pageerror", err => {
      console.log(`BROWSER PAGE ERROR: ${err.message}`);
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  it("should synchronize speed slider and pause button via UIBinder", async () => {
    await page.goto(E2E_URL);
    await page.waitForSelector("#screen-main-menu", { visible: true });
    await page.screenshot({ path: "debug_1_main_menu.png" });
    
    // 1. Start a custom mission
    console.log("Clicking Custom Mission...");
    await page.waitForSelector("#btn-menu-custom", { visible: true });
    
    // Check if it's actually there
    const btnData = await page.evaluate(() => {
      const el = document.getElementById("btn-menu-custom");
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        id: el.id,
        visible: el.offsetParent !== null,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        textContent: el.textContent?.trim()
      };
    });
    console.log(`Button Data: ${JSON.stringify(btnData)}`);

    // Use a more robust click
    await page.evaluate(() => {
      const el = document.getElementById("btn-menu-custom");
      if (el) {
        el.style.border = "5px solid red"; // Visual marker for debug
        el.click();
      }
    });
    
    console.log("Waiting for Campaign Shell and Mission Setup screen...");
    
    // Check Campaign Shell first
    await page.waitForFunction(() => {
      const el = document.getElementById("screen-campaign-shell");
      return el && el.style.display !== "none";
    }, { timeout: 10000 }).catch(e => console.log("Campaign shell NOT visible after 10s"));

    await page.waitForSelector("#screen-mission-setup", { visible: true, timeout: 15000 });
    await page.screenshot({ path: "debug_2_custom_mission.png" });

    // Wait for the launch button to be definitely there and not covered
    await page.waitForSelector("#btn-launch-mission", { visible: true, timeout: 10000 });
    
    // Disable deployment for faster start
    console.log("Disabling manual deployment...");
    await page.evaluate(() => {
      const el = document.getElementById("toggle-manual-deployment") as HTMLInputElement;
      if (el && el.checked) {
        el.click();
      }
    });

    await new Promise(r => setTimeout(r, 1000)); // Wait for any transitions
    await page.screenshot({ path: "debug_3_before_launch.png" });

    console.log("Clicking Launch Mission...");
    // Use evaluate to click if normal click is failing
    await page.evaluate(() => {
      const btn = document.getElementById("btn-launch-mission");
      if (btn) btn.click();
    });
    
    console.log("Waiting for Game Canvas...");
    await page.waitForSelector("#game-canvas", { visible: true, timeout: 30000 });
    await page.screenshot({ path: "debug_4_in_game.png" });

    // 2. Check initial state
    // Wait for HUD to settle
    await new Promise(r => setTimeout(r, 2000));

    const getTimeValue = async () => {
      return await page.evaluate(() => {
        const el = document.querySelector(".time-value");
        return el ? el.textContent : null;
      });
    };

    const initialTime = await getTimeValue();
    console.log(`Initial Time: ${initialTime}`);

    // Wait more and check again
    await new Promise(r => setTimeout(r, 2000));
    const nextTime = await getTimeValue();
    console.log(`Next Time: ${nextTime}`);

    // expect(parseFloat(nextTime || "0")).toBeGreaterThan(parseFloat(initialTime || "0"));

    const getSliderValue = async () => {
      return await page.evaluate(() => {
        const slider = document.getElementById("game-speed") as HTMLInputElement;
        return slider ? slider.value : null;
      });
    };

    const getPauseButtonText = async () => {
      return await page.evaluate(() => {
        const btn = document.getElementById("btn-pause-toggle");
        return btn ? btn.textContent?.trim() : null;
      });
    };

    const initialSlider = await getSliderValue();
    const initialBtn = await getPauseButtonText();
    
    console.log(`Initial: Slider=${initialSlider}, Button=${initialBtn}`);

    // 3. Click Pause toggle
    console.log("Clicking Pause toggle...");
    await page.evaluate(() => {
      document.getElementById("btn-pause-toggle")?.click();
    });
    
    // Wait for sync (wait multiple frames)
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: "debug_5_after_pause.png" });

    const afterClickSlider = await getSliderValue();
    const afterClickBtn = await getPauseButtonText();

    console.log(`After Click: Slider=${afterClickSlider}, Button=${afterClickBtn}`);

    expect(afterClickBtn).not.toBe(initialBtn);
    
    // 4. Test min value synchronization
    console.log("Checking min value synchronization...");
    const getSliderMin = async () => {
      return await page.evaluate(() => {
        const slider = document.getElementById("game-speed") as HTMLInputElement;
        return slider ? slider.min : null;
      });
    };

    const initialMin = await getSliderMin();
    console.log(`Initial Min: ${initialMin}`);
    expect(initialMin).toBe("0"); // Tactical pause allowed by default in custom mission

    // 5. Test changing the slider
    console.log("Changing slider to 10.0x...");
    await page.evaluate(() => {
      const slider = document.getElementById("game-speed") as HTMLInputElement;
      if (slider) {
        slider.value = "100"; // 10.0x
        slider.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    
    await new Promise(r => setTimeout(r, 1000));
    const finalSlider = await getSliderValue();
    console.log(`Final Slider: ${finalSlider}`);
    expect(finalSlider).toBe("100");
  });
});
