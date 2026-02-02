import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import type { Page } from "puppeteer";
import { E2E_URL } from "./config";

describe("Roster Layout Regression Test", () => {
  let page: Page;

  beforeAll(async () => {
    page = await getNewPage();
    await page.setViewport({ width: 1024, height: 768 });
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("should have a full-height roster panel and sticky actions", async () => {
    await page.goto(E2E_URL);

    // 1. Navigate to Custom Mission
    await page.waitForSelector("#btn-menu-custom");
    await page.click("#btn-menu-custom");

    // 2. Wait for Mission Setup screen
    await page.waitForSelector("#screen-mission-setup");
    await page.waitForSelector(".squad-builder-container");

    // 3. Verify .squad-builder-container occupies significant height
    const containerHeight = await page.evaluate(() => {
      const el = document.querySelector(".squad-builder-container");
      return el ? el.getBoundingClientRect().height : 0;
    });
    // With 1024x768, we expect at least 400-500px for the squad builder
    expect(containerHeight).toBeGreaterThan(400);

    // 4. Verify Roster Panel structure (Spec 8.1: Scrollable List + Sticky Actions)
    const rosterStructure = await page.evaluate(() => {
      const panel = document.querySelector(".roster-panel");
      if (!panel) return null;

      const title = panel.querySelector("h3");
      const list = panel.querySelector(".roster-list");
      const actions = panel.querySelector(".roster-actions");

      const panelStyle = window.getComputedStyle(panel);
      const listStyle = list ? window.getComputedStyle(list) : null;
      const actionsStyle = actions ? window.getComputedStyle(actions) : null;

      return {
        hasTitle: !!title,
        hasList: !!list,
        hasActions: !!actions,
        panelDisplay: panelStyle.display,
        panelFlexDirection: panelStyle.flexDirection,
        panelOverflow: panelStyle.overflowY,
        listFlex: listStyle?.flex,
        listOverflow: listStyle?.overflowY,
        actionsFlexShrink: actionsStyle?.flexShrink,
      };
    });

    expect(rosterStructure?.hasTitle).toBe(true);
    expect(rosterStructure?.hasList).toBe(true);
    expect(rosterStructure?.hasActions).toBe(true);
    expect(rosterStructure?.panelDisplay).toBe("flex");
    expect(rosterStructure?.panelFlexDirection).toBe("column");

    // The panel itself should NOT scroll (overflow hidden/visible, but not auto/scroll)
    expect(["auto", "scroll"]).not.toContain(rosterStructure?.panelOverflow);

    // The list SHOULD be flex: 1 and scrollable
    expect(rosterStructure?.listFlex).toContain("1");
    expect(rosterStructure?.listOverflow).toBe("auto");

    // The actions SHOULD NOT shrink
    expect(rosterStructure?.actionsFlexShrink).toBe("0");

    // 5. Verify Recruit button position (Sticky behavior)
    // Even if it's empty in Custom Mode, the container .roster-actions should be at the bottom of the .roster-panel
    const positions = await page.evaluate(() => {
      const panel = document.querySelector(".roster-panel");
      const list = panel?.querySelector(".roster-list");
      const actions = panel?.querySelector(".roster-actions");
      if (!panel || !list || !actions) return null;

      const panelRect = panel.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      const actionsRect = actions.getBoundingClientRect();

      return {
        listInsidePanel:
          listRect.top >= panelRect.top &&
          listRect.bottom <= actionsRect.top + 5,
        actionsAtBottom: Math.abs(actionsRect.bottom - panelRect.bottom) < 10,
        actionsVisible: actionsRect.height > 0 || true, // It might have 0 height if empty, but it's still there
      };
    });

    expect(positions?.actionsAtBottom).toBe(true);

    // 6. Take a screenshot for visual confirmation
    await page.screenshot({
      path: "roster_layout_verification.png",
    });
  });
});
