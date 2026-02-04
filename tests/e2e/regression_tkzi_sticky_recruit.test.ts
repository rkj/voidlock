import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Regression TKZI - Sticky Recruitment Button", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should keep Recruit button in viewport when roster is scrolled", async () => {
    await page.goto(E2E_URL, { waitUntil: "networkidle0" });
    await page.evaluate(() => localStorage.clear());
    await page.goto(E2E_URL, { waitUntil: "networkidle0" });

    // 1. Start Campaign
    await page.waitForSelector("#btn-menu-campaign");
    await page.click("#btn-menu-campaign");

    const startBtnSelector = ".campaign-setup-wizard .primary-button";
    await page.waitForSelector(startBtnSelector);
    await page.click(startBtnSelector);

    // 2. Select first node
    const nodeSelector = ".campaign-node.accessible";
    await page.waitForSelector(nodeSelector);
    await page.click(nodeSelector);

    // 3. In Mission Setup, recruit many soldiers to force scroll
    await page.waitForSelector("#screen-mission-setup");

    // Check if Recruit button exists
    const recruitBtnSelector = ".btn-recruit";
    await page.waitForSelector(recruitBtnSelector);

    // Recruit 10 soldiers
    for (let i = 0; i < 10; i++) {
      await page.click(recruitBtnSelector);
      // Wait for roster update
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // 4. Verify scrolling and stickiness
    const stickyCheck = await page.evaluate(() => {
      const list = document.querySelector(".roster-list");
      const actions = document.querySelector(".roster-actions");
      const panel = document.querySelector(".roster-panel");
      if (!list || !actions || !panel) return null;

      // Scroll to bottom
      list.scrollTop = list.scrollHeight;

      const actionsRect = actions.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();

      return {
        isListScrolled: list.scrollTop > 0,
        isActionsAtBottom: Math.abs(actionsRect.bottom - panelRect.bottom) < 10,
        isActionsVisible: actionsRect.top >= listRect.bottom - 10,
        actionsHeight: actionsRect.height,
      };
    });

    expect(stickyCheck?.isListScrolled).toBe(true);
    expect(stickyCheck?.isActionsAtBottom).toBe(true);
    expect(stickyCheck?.actionsHeight).toBeGreaterThan(0);

    // 5. Take screenshot
    await page.screenshot({
      path: "tests/e2e/__snapshots__/regression_tkzi_sticky_recruit.png",
    });
  });
});
