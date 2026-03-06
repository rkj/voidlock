import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("UIBinder Synchronization", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
    
    page.on("console", msg => {
      console.log(`BROWSER CONSOLE: [${msg.type()}] ${msg.text()}`);
    });

    page.on("pageerror", err => {
      console.log(`BROWSER PAGE ERROR: ${err.message}`);
    });
  });

  beforeEach(async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => {
        localStorage.clear();
        window.location.hash = "";
    });
    await page.goto(E2E_URL);
  });

  afterAll(async () => {
    await closeBrowser();
  });

  async function startCustomMission() {
    await page.waitForSelector("#screen-main-menu", { visible: true });
    
    // 1. Start a custom mission
    console.log("Clicking Custom Mission...");
    await page.waitForSelector("#btn-menu-custom", { visible: true });
    
    await page.evaluate(() => {
      const el = document.getElementById("btn-menu-custom");
      if (el) el.click();
    });
    
    console.log("Waiting for Campaign Shell and Mission Setup screen...");
    
    await page.waitForSelector("#screen-mission-setup", { visible: true, timeout: 15000 });

    // Disable deployment for faster start
    console.log("Disabling manual deployment...");
    await page.evaluate(() => {
      const el = document.getElementById("toggle-manual-deployment") as HTMLInputElement;
      if (el && el.checked) el.click();
      
      // Ensure tactical pause is allowed for these tests
      const pauseEl = document.getElementById("toggle-pause-allowed") as HTMLInputElement;
      if (pauseEl && !pauseEl.checked) pauseEl.click();
    });

    await new Promise(r => setTimeout(r, 500));

    console.log("Clicking Launch Mission...");
    await page.evaluate(() => {
      const btn = document.getElementById("btn-launch-mission");
      if (btn) btn.click();
    });
    
    console.log("Waiting for Game Canvas...");
    await page.waitForSelector("#game-canvas", { visible: true, timeout: 30000 });
    // Wait for HUD to settle
    await new Promise(r => setTimeout(r, 2000));
  }

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

  const getSpeedValueText = async () => {
    return await page.evaluate(() => {
      const el = document.getElementById("speed-value");
      return el ? el.textContent?.trim() : null;
    });
  };

  it("should synchronize speed slider and pause button via UIBinder", async () => {
    await startCustomMission();

    const initialSlider = await getSliderValue();
    const initialBtn = await getPauseButtonText();
    
    console.log(`Initial: Slider=${initialSlider}, Button=${initialBtn}`);

    // Click Pause toggle
    console.log("Clicking Pause toggle...");
    await page.click("#btn-pause-toggle");
    
    // Wait for sync
    await new Promise(r => setTimeout(r, 1000));

    const afterClickSlider = await getSliderValue();
    const afterClickBtn = await getPauseButtonText();

    console.log(`After Click: Slider=${afterClickSlider}, Button=${afterClickBtn}`);

    expect(afterClickBtn).toBe("▶ Play");
    expect(afterClickSlider).toBe("50"); // ADR 0048: Slider MUST remain at targetTimeScale during pause
    
    // Test changing the slider via keyboard to simulate real interaction
    console.log("Changing slider to 10.0x via keyboard...");
    await page.focus("#game-speed");
    await page.keyboard.press("End");
    // CRITICAL: Blur to allow UIBinder to take control again
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    
    await new Promise(r => setTimeout(r, 1000));
    const finalSlider = await getSliderValue();
    const finalBtn = await getPauseButtonText();
    console.log(`Final Slider: ${finalSlider}, Button: ${finalBtn}`);
    
    expect(finalSlider).toBe("100");
    expect(finalBtn).toBe("|| Pause"); // Should have unpaused
  });

  it("should verify two-way loop between Pause and Slider", async () => {
    await startCustomMission();

    // 1. Initial State: Playing at 1.0x (Slider 50)
    expect(await getSliderValue()).toBe("50");
    expect(await getPauseButtonText()).toBe("|| Pause");
    expect(await getSpeedValueText()).toBe("1.0x");

    // 2. Pause the game via button
    console.log("Pausing via button...");
    await page.click("#btn-pause-toggle");
    await new Promise(r => setTimeout(r, 1000));

    expect(await getPauseButtonText()).toBe("▶ Play");
    expect(await getSliderValue()).toBe("50"); // ADR 0048: Slider MUST remain at targetTimeScale during pause
    expect(await getSpeedValueText()).toContain("Active Pause");

    // 3. Resume the game via button
    console.log("Resuming via button...");
    await page.click("#btn-pause-toggle");
    await new Promise(r => setTimeout(r, 1000));

    expect(await getPauseButtonText()).toBe("|| Pause");
    expect(await getSliderValue()).toBe("50"); // Should restore to 1.0x
    expect(await getSpeedValueText()).toBe("1.0x");

    // 4. Set slider to 10.0x via keyboard
    console.log("Setting slider to 10.0x via keyboard...");
    await page.focus("#game-speed");
    await page.keyboard.press("End");
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await new Promise(r => setTimeout(r, 1000));
    expect(await getSpeedValueText()).toBe("10.0x");

    // 5. Pause again
    console.log("Pausing again...");
    await page.click("#btn-pause-toggle");
    await new Promise(r => setTimeout(r, 1000));
    expect(await getSliderValue()).toBe("100"); // ADR 0048: MUST NOT snap to 0

    // 6. Resume again - should restore to 10.0x
    console.log("Resuming again...");
    await page.click("#btn-pause-toggle");
    await new Promise(r => setTimeout(r, 1000));
    expect(await getSliderValue()).toBe("100");
    expect(await getSpeedValueText()).toBe("10.0x");

    // 7. Move slider while paused - should unpause
    console.log("Pausing...");
    await page.click("#btn-pause-toggle");
    await new Promise(r => setTimeout(r, 1000));
    expect(await getSliderValue()).toBe("100"); // ADR 0048: MUST NOT snap to 0

    console.log("Moving slider via evaluate while paused...");
    await page.evaluate(() => {
      const slider = document.getElementById("game-speed") as HTMLInputElement;
      if (slider) {
        slider.value = "75";
        slider.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 1000));
    
    expect(await getPauseButtonText()).toBe("|| Pause");
    const val = await getSliderValue();
    expect(parseInt(val || "0")).toBeGreaterThan(0);
  });
});
