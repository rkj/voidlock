// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DebriefScreen } from "@src/renderer/screens/DebriefScreen";
import { MissionReport } from "@src/shared/campaign_types";

describe("DebriefScreen Visual Audit", () => {
  let container: HTMLElement;
  let onContinue: any;
  let mockGameClient: any;
  let screen: DebriefScreen;

  beforeEach(() => {
    // Mock Canvas Context
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
    } as any);

    document.body.innerHTML = '<div id="screen-debrief"></div>';
    container = document.getElementById("screen-debrief")!;
    onContinue = vi.fn();
    mockGameClient = {
      addStateUpdateListener: vi.fn(),
      removeStateUpdateListener: vi.fn(),
      queryState: vi.fn(),
      getIsPaused: vi.fn(() => true),
      togglePause: vi.fn(),
      getTargetScale: vi.fn(() => 1.0),
  getTimeScale: vi.fn().mockReturnValue(1.0),
      setTimeScale: vi.fn(),
      getReplayData: vi.fn(() => ({})),
      loadReplay: vi.fn(),
      stop: vi.fn(),
    };
    screen = new DebriefScreen("screen-debrief", mockGameClient, onContinue);
  });

  it("should use new CSS classes according to spec", () => {
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

    // Split Layout
    const debriefContainer = container.querySelector(
      ".debrief-container",
    ) as HTMLElement;
    expect(debriefContainer).not.toBeNull();

    // Left Pane
    const summary = debriefContainer.querySelector(
      ".debrief-summary",
    ) as HTMLElement;
    expect(summary).not.toBeNull();

    // Right Pane
    const replayViewport = debriefContainer.querySelector(
      ".debrief-replay-viewport",
    ) as HTMLElement;
    expect(replayViewport).not.toBeNull();

    // Subheader
    const subHeader = summary.querySelector(
      ".debrief-subheader",
    ) as HTMLElement;
    expect(subHeader).not.toBeNull();

    // Panels
    const panels = summary.querySelectorAll(".debrief-panel");
    expect(panels.length).toBe(2);

    const panelTitle = panels[0].querySelector(
      ".debrief-panel-title",
    ) as HTMLElement;
    expect(panelTitle).not.toBeNull();

    // Stat rows
    const statRows = summary.querySelectorAll(".debrief-stat-row");
    expect(statRows.length).toBeGreaterThan(0);

    // Resource section
    const resourceSection = summary.querySelector(
      ".debrief-resource-section",
    ) as HTMLElement;
    expect(resourceSection).not.toBeNull();

    // XP Bar (from SoldierWidget)
    const xpBar = summary.querySelector(".debrief-xp-bar") as HTMLElement;
    expect(xpBar).not.toBeNull();

    // XP Fills
    const xpFillBefore = summary.querySelector(
      ".debrief-xp-fill-before",
    ) as HTMLElement;
    expect(xpFillBefore).not.toBeNull();
    expect(xpFillBefore.style.width).not.toBe(""); // This remains inline because it's dynamic

    // Footer
    const footer = summary.querySelector(".debrief-footer") as HTMLElement;
    expect(footer).not.toBeNull();

    // Button
    const button = summary.querySelector(".debrief-button") as HTMLElement;
    expect(button).not.toBeNull();

    // Replay Viewport elements
    const canvas = replayViewport.querySelector("canvas");
    expect(canvas).not.toBeNull();

    const controls = replayViewport.querySelector(".replay-controls");
    expect(controls).not.toBeNull();

    const playbackBtn = controls?.querySelector(".replay-btn");
    expect(playbackBtn).not.toBeNull();

    const speedBtns = controls?.querySelectorAll(".replay-speed-btn");
    expect(speedBtns?.length).toBe(4);
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
