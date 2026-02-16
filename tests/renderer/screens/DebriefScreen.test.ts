// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DebriefScreen } from "@src/renderer/screens/DebriefScreen";
import { MissionReport } from "@src/shared/campaign_types";

describe("DebriefScreen", () => {
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
          name: "Sgt. Slaughter",
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
    expect(container.innerHTML).toContain("Mission Success");
    expect(container.innerHTML).toContain("10"); // aliensKilled
    expect(container.innerHTML).toContain("+150"); // scrapGained
    expect(container.innerHTML).toContain("Sgt. Slaughter");
    expect(container.innerHTML).toContain("debrief-xp-bar");
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

    expect(container.innerHTML).toContain("Mission Failed");
    expect(container.innerHTML).toContain("Dead");
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
    const button = container.querySelector(
      ".debrief-button",
    ) as HTMLButtonElement;
    button?.click();

    expect(onContinue).toHaveBeenCalled();
  });

  it("should register state update listener on show", () => {
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
    expect(mockGameClient.addStateUpdateListener).toHaveBeenCalled();
  });

  it("should unregister state update listener on hide", () => {
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
    screen.hide();
    expect(mockGameClient.removeStateUpdateListener).toHaveBeenCalled();
  });

  it("should render state when replay update is received", () => {
    const report: MissionReport = {
      nodeId: "node_1",
      seed: 12345,
      result: "Won",
      aliensKilled: 0,
      scrapGained: 0,
      intelGained: 0,
      timeSpent: 100,
      soldierResults: [],
    };
    screen.show(report);

    // Get the registered listener
    const listener = mockGameClient.addStateUpdateListener.mock.calls[0][0];

    const mockState: any = {
      t: 50,
      map: { width: 10, height: 10, cells: [] },
      units: [],
      enemies: [],
      loot: [],
      mines: [],
      stats: {},
      settings: { mode: "Replay" },
      visibleCells: [],
      discoveredCells: [],
    };

    listener(mockState);

    // Check if progress bar updated
    const progressFill = container.querySelector(
      ".replay-progress-fill",
    ) as HTMLElement;
    expect(progressFill.style.width).toBe("50%");

    // Check if scrubber updated
    const scrubber = container.querySelector(
      ".replay-scrubber",
    ) as HTMLInputElement;
    expect(scrubber.value).toBe("50");
  });

  it("should call seek when scrubber is changed", () => {
    mockGameClient.seek = vi.fn();
    const report: MissionReport = {
      nodeId: "node_1",
      seed: 12345,
      result: "Won",
      aliensKilled: 0,
      scrapGained: 0,
      intelGained: 0,
      timeSpent: 1000,
      soldierResults: [],
    };
    screen.show(report);

    const scrubber = container.querySelector(
      ".replay-scrubber",
    ) as HTMLInputElement;
    scrubber.value = "50";
    scrubber.dispatchEvent(new Event("input"));

    expect(mockGameClient.seek).toHaveBeenCalledWith(500); // 50% of 1000
  });

  it("should toggle looping when loop button is clicked", () => {
    const report: MissionReport = {
      nodeId: "node_1",
      seed: 12345,
      result: "Won",
      aliensKilled: 0,
      scrapGained: 0,
      intelGained: 0,
      timeSpent: 1000,
      soldierResults: [],
    };
    screen.show(report);

    const loopBtn = Array.from(container.querySelectorAll(".replay-btn")).find(
      (btn) => btn.textContent?.includes("Loop"),
    ) as HTMLButtonElement;

    expect(loopBtn.textContent).toBe("Loop: Off");
    loopBtn.click();
    expect(loopBtn.textContent).toBe("Loop: On");
    expect(loopBtn.classList.contains("active")).toBe(true);

    loopBtn.click();
    expect(loopBtn.textContent).toBe("Loop: Off");
    expect(loopBtn.classList.contains("active")).toBe(false);
  });

  it("should call onExport when export button is clicked", () => {
    const onExport = vi.fn();
    screen = new DebriefScreen(
      "screen-debrief",
      mockGameClient,
      onContinue,
      undefined,
      onExport,
    );

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

    const exportBtn = Array.from(
      container.querySelectorAll(".debrief-button"),
    ).find(
      (btn) => btn.textContent === "Export Recording",
    ) as HTMLButtonElement;

    expect(exportBtn).toBeTruthy();
    exportBtn.click();
    expect(onExport).toHaveBeenCalled();
  });
});
