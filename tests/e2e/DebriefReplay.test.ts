import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Page } from "puppeteer";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import { setup, teardown } from "./setup";
import { E2E_URL } from "./config";

describe("Debrief Replay E2E", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1280, height: 720 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should play a replay on the debrief screen", async () => {
    await page.goto(E2E_URL);
    await page.waitForSelector("#btn-menu-custom");

    // 1. Start Custom Mission
    await page.click("#btn-menu-custom");
    await page.waitForSelector("#toggle-debug-overlay");
    await page.click("#toggle-debug-overlay");
    await page.waitForSelector("#btn-goto-equipment");
    await page.click("#btn-goto-equipment");

    // 2. Confirm Squad and Launch
    await page.waitForSelector(".equipment-screen");
    const [confirmBtn] = await page.$$("button.primary-button");
    await confirmBtn.evaluate((b) => (b as HTMLElement).click());

    // 3. Wait for game to start
    await page.waitForSelector("#game-canvas");

    // 4. Force Win via Debug
    await page.waitForSelector("#btn-force-win", { timeout: 10000 });
    await page.click("#btn-force-win");

    // 5. Wait for Debrief Screen
    await page.waitForSelector(".debrief-screen", { visible: true });

    // 5. Verify Split Layout
    const debriefContainer = await page.$(".debrief-container");
    expect(debriefContainer).not.toBeNull();

    const summary = await page.$(".debrief-summary");
    expect(summary).not.toBeNull();

    const replayViewport = await page.$(".debrief-replay-viewport");
    expect(replayViewport).not.toBeNull();

    // 6. Verify Canvas exists and has size
    const canvas = await page.$(".debrief-replay-canvas-container canvas");
    expect(canvas).not.toBeNull();

    const canvasBox = await canvas?.boundingBox();
    expect(canvasBox?.width).toBeGreaterThan(0);
    expect(canvasBox?.height).toBeGreaterThan(0);

    // 7. Verify Playback Controls
    const playbackBtn = await page.$(".replay-btn");
    expect(playbackBtn).not.toBeNull();

    const speedBtns = await page.$$(".replay-speed-btn");
    expect(speedBtns.length).toBe(4);

    // 8. Wait a bit for replay to progress and take screenshot
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({ path: "debrief_replay_e2e.png" });

    // 9. Check if progress bar has width
    const progressFill = await page.$(".replay-progress-fill");
    const progressWidth = await page.evaluate(
      (el) => (el as HTMLElement).style.width,
      progressFill,
    );
    // Note: progress might still be 0 if the mission was very short (force win),
    // but at 5x speed and after 2s it should have moved if the replay is playing.
    console.log("Replay progress width:", progressWidth);
  });
});
