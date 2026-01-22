// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DebriefScreen } from "@src/renderer/screens/DebriefScreen";
import { MissionReport } from "@src/shared/campaign_types";

describe("DebriefScreen Visual Audit", () => {
  let container: HTMLElement;
  let onContinue: any;
  let screen: DebriefScreen;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-debrief"></div>';
    container = document.getElementById("screen-debrief")!;
    onContinue = vi.fn();
    screen = new DebriefScreen("screen-debrief", onContinue);
  });

  it("should use new CSS classes instead of inline styles", () => {
    const report: MissionReport = {
      nodeId: "node_1",
      seed: 12345,
      result: "Won",
      aliensKilled: 10,
      scrapGained: 150,
      intelGained: 5,
      timeSpent: 600,
      soldierResults: [
        {
          soldierId: "Sgt. Slaughter",
          xpBefore: 20,
          xpGained: 70,
          kills: 5,
          promoted: false,
          status: "Healthy",
        },
      ],
    };

    screen.show(report);

    // Main container
    expect(container.classList.contains("debrief-screen")).toBe(true);

    // Inner wrapper
    const inner = container.querySelector(".debrief-inner") as HTMLElement;
    expect(inner).not.toBeNull();
    expect(inner.style.margin).toBe(""); // Should be in CSS

    // Subheader
    const subHeader = inner.querySelector(".debrief-subheader") as HTMLElement;
    expect(subHeader).not.toBeNull();
    expect(subHeader.style.marginBottom).toBe(""); // Should be in CSS

    // Content Grid
    const content = container.querySelector(".debrief-content") as HTMLElement;
    expect(content).not.toBeNull();
    expect(content.style.display).toBe(""); // Should be in CSS

    // Panels
    const panels = container.querySelectorAll(".debrief-panel");
    expect(panels.length).toBe(2);

    const panelTitle = panels[0].querySelector(
      ".debrief-panel-title",
    ) as HTMLElement;
    expect(panelTitle).not.toBeNull();
    expect(panelTitle.style.fontSize).toBe(""); // Should be in CSS

    // Stat rows
    const statRows = container.querySelectorAll(".debrief-stat-row");
    expect(statRows.length).toBeGreaterThan(0);

    // Resource section
    const resourceSection = container.querySelector(
      ".debrief-resource-section",
    ) as HTMLElement;
    expect(resourceSection).not.toBeNull();

    // XP Bar
    const xpBar = container.querySelector(".debrief-xp-bar") as HTMLElement;
    expect(xpBar).not.toBeNull();

    // XP Fills
    const xpFillBefore = container.querySelector(
      ".debrief-xp-fill-before",
    ) as HTMLElement;
    expect(xpFillBefore).not.toBeNull();
    expect(xpFillBefore.style.width).not.toBe(""); // This remains inline because it's dynamic

    // Footer
    const footer = container.querySelector(".debrief-footer") as HTMLElement;
    expect(footer).not.toBeNull();

    // Button
    const button = container.querySelector(".debrief-button") as HTMLElement;
    expect(button).not.toBeNull();
  });

  it("should render 4 soldiers without issues", () => {
    const report: MissionReport = {
      nodeId: "node_1",
      seed: 12345,
      result: "Won",
      aliensKilled: 50,
      scrapGained: 1000,
      intelGained: 25,
      timeSpent: 3600,
      soldierResults: [
        {
          soldierId: "Soldier 1",
          xpBefore: 100,
          xpGained: 50,
          kills: 10,
          promoted: true,
          newLevel: 2,
          status: "Healthy",
        },
        {
          soldierId: "Soldier 2",
          xpBefore: 200,
          xpGained: 60,
          kills: 15,
          promoted: false,
          status: "Wounded",
          recoveryTime: 2,
        },
        {
          soldierId: "Soldier 3",
          xpBefore: 300,
          xpGained: 70,
          kills: 20,
          promoted: true,
          newLevel: 3,
          status: "Healthy",
        },
        {
          soldierId: "Soldier 4",
          xpBefore: 400,
          xpGained: 80,
          kills: 5,
          promoted: false,
          status: "Dead",
        },
      ],
    };

    screen.show(report);

    const items = container.querySelectorAll(".debrief-item");
    expect(items.length).toBe(4);
  });
});
