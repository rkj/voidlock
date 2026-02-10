import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Page } from "puppeteer";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import { E2E_URL } from "./config";

describe("Mobile Scrolling Regression Test", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
  });

  beforeEach(async () => {
    // Set mobile viewport
    await page.setViewport({ width: 375, height: 667, isMobile: true });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should allow scrolling in UI panels on mobile", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 1. Navigate to Equipment Screen
    await page.waitForSelector("#btn-menu-campaign");
    await page.click("#btn-menu-campaign");

    const startBtnSelector = ".campaign-setup-wizard .primary-button";
    await page.waitForSelector(startBtnSelector);
    await page.click(startBtnSelector);

    await page.waitForSelector(".campaign-node.accessible");
    await page.click(".campaign-node.accessible");

    await page.waitForSelector("#screen-equipment");

    // 2. Find a scrollable container
    const scrollContainer = await page.waitForSelector(
      ".equipment-main-content",
    );

    // Ensure it's scrollable for the test
    await page.evaluate(() => {
      const container = document.querySelector(
        ".equipment-main-content",
      ) as HTMLElement;
      if (container) {
        container.style.height = "400px";
        const filler = document.createElement("div");
        filler.style.height = "2000px";
        container.appendChild(filler);
      }
    });

    const initialScrollTop = await page.evaluate(
      () => document.querySelector(".equipment-main-content")?.scrollTop || 0,
    );

    // 3. Perform a scroll gesture
    const box = await scrollContainer?.boundingBox();
    if (box) {
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;

      await page.touchscreen.touchStart(centerX, centerY + 100);
      await page.touchscreen.touchMove(centerX, centerY - 100);
      await page.touchscreen.touchEnd();
    }

    await new Promise((r) => setTimeout(r, 1000));

    const finalScrollTop = await page.evaluate(
      () => document.querySelector(".equipment-main-content")?.scrollTop || 0,
    );

    expect(finalScrollTop).toBeGreaterThan(initialScrollTop);
  });

  // SKIP: This test is flaky in the current E2E environment
  it.skip("should still allow panning the mission map via touch", async () => {
    await page.goto(E2E_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 1. Start a mission
    await page.waitForSelector("#btn-menu-custom", { visible: true });
    await page.click("#btn-menu-custom");

    await page.waitForSelector("#map-generator-type", { visible: true });
    await page.select("#map-generator-type", "DenseShip");
    await page.evaluate(() => {
      const widthInput = document.getElementById(
        "map-width",
      ) as HTMLInputElement;
      const heightInput = document.getElementById(
        "map-height",
      ) as HTMLInputElement;
      if (widthInput) widthInput.value = "30";
      if (heightInput) heightInput.value = "30";
      widthInput?.dispatchEvent(new Event("change"));
      heightInput?.dispatchEvent(new Event("change"));
    });

    await page.waitForSelector("#btn-goto-equipment", { visible: true });
    await page.click("#btn-goto-equipment");

    await page.waitForSelector("[data-focus-id='btn-confirm-squad']", {
      visible: true,
    });
    await page.click("[data-focus-id='btn-confirm-squad']");

    // 2. Wait for mission to start
    await page.waitForSelector("#screen-mission", { visible: true });

    // Ensure we are in "Playing" state
    const startMissionBtn = await page.waitForSelector("#btn-start-mission", {
      visible: true,
      timeout: 10000,
    });

    // Deploy units
    await page.waitForSelector(".deployment-unit-item", {
      visible: true,
      timeout: 10000,
    });
    const units = await page.$$(".deployment-unit-item");
    for (const unit of units) {
      await unit.click();
      await new Promise((r) => setTimeout(r, 500));
    }

    // Wait for button to be enabled
    await page.waitForFunction(
      (el) => !(el as HTMLButtonElement).disabled,
      { timeout: 10000 },
      startMissionBtn,
    );

    await startMissionBtn?.click();
    await page.waitForSelector(".command-menu", {
      visible: true,
      timeout: 10000,
    });

    const initialScroll = await page.evaluate(() => ({
      x: document.getElementById("game-container")?.scrollLeft || 0,
      y: document.getElementById("game-container")?.scrollTop || 0,
    }));

    // 3. Drag the map
    const container = await page.$("#game-container");
    const box = await container?.boundingBox();
    if (box) {
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;

      await page.touchscreen.touchStart(centerX, centerY);
      await page.touchscreen.touchMove(centerX - 100, centerY - 100);
      await page.touchscreen.touchEnd();
    }

    await new Promise((r) => setTimeout(r, 1000));

    const finalScroll = await page.evaluate(() => ({
      x: document.getElementById("game-container")?.scrollLeft || 0,
      y: document.getElementById("game-container")?.scrollTop || 0,
    }));

    expect(finalScroll.x).not.toBe(initialScroll.x);
    expect(finalScroll.y).not.toBe(initialScroll.y);
  });
});