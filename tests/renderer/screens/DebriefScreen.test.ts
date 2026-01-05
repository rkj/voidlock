// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DebriefScreen } from "@src/renderer/screens/DebriefScreen";
import { MissionReport } from "@src/shared/campaign_types";

describe("DebriefScreen", () => {
  let container: HTMLElement;
  let onContinue: any;
  let screen: DebriefScreen;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-debrief"></div>';
    container = document.getElementById("screen-debrief")!;
    onContinue = vi.fn();
    screen = new DebriefScreen("screen-debrief", onContinue);
  });

  it("should render success report correctly", () => {
    const report: MissionReport = {
      nodeId: "node_1",
      seed: 12345,
      result: "Won",
      aliensKilled: 10,
      scrapGained: 150,
      intelGained: 5,
      timeSpent: 600, // 10 seconds at 60fps
      soldierResults: [
        {
          soldierId: "soldier_1",
          xpBefore: 20,
          xpGained: 70,
          kills: 5,
          promoted: false,
          status: "Healthy",
        },
      ],
    };

    screen.show(report);

    expect(container.style.display).toBe("flex");
    expect(container.innerHTML).toContain("MISSION SUCCESS");
    expect(container.innerHTML).toContain("10"); // aliensKilled
    expect(container.innerHTML).toContain("+150"); // scrapGained
    expect(container.innerHTML).toContain("soldier_1");
    expect(container.innerHTML).toContain("XP: 20 (+70)");
  });

  it("should render failure report correctly", () => {
    const report: MissionReport = {
      nodeId: "node_1",
      seed: 12345,
      result: "Lost",
      aliensKilled: 2,
      scrapGained: 10,
      intelGained: 0,
      timeSpent: 300,
      soldierResults: [
        {
          soldierId: "soldier_1",
          xpBefore: 120,
          xpGained: 10,
          kills: 0,
          promoted: false,
          status: "Dead",
        },
      ],
    };

    screen.show(report);

    expect(container.innerHTML).toContain("MISSION FAILED");
    expect(container.innerHTML).toContain("DEAD");
    expect(container.innerHTML).toContain("XP: 120 (+10)");
  });

  it("should call onContinue when button is clicked", () => {
    const report: MissionReport = {
      nodeId: "node_1",
      seed: 12345,
      result: "Won",
      aliensKilled: 0,
      scrapGained: 0,
      intelGained: 0,
      timeSpent: 0,
      soldierResults: [],
    };

    screen.show(report);
    const button = container.querySelector("button");
    button?.click();

    expect(onContinue).toHaveBeenCalled();
  });
});
