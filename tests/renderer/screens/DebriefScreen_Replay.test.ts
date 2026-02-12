// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DebriefScreen } from "@src/renderer/screens/DebriefScreen";
import { MissionReport } from "@src/shared/campaign_types";

describe("DebriefScreen Replay Button", () => {
  let container: HTMLElement;
  let onContinue: any;
  let onReplay: any;
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
    onReplay = vi.fn();
    mockGameClient = {
      addStateUpdateListener: vi.fn(),
      removeStateUpdateListener: vi.fn(),
      getIsPaused: vi.fn(() => true),
      togglePause: vi.fn(),
      getTargetScale: vi.fn(() => 1.0),
      setTimeScale: vi.fn(),
      getReplayData: vi.fn(() => ({})),
      loadReplay: vi.fn(),
      stop: vi.fn(),
    };
    screen = new DebriefScreen(
      "screen-debrief",
      mockGameClient,
      onContinue,
      onReplay,
    );
  });

  it("should show Replay button only for custom missions", () => {
    const customReport: MissionReport = {
      nodeId: "custom",
      seed: 12345,
      result: "Won",
      aliensKilled: 10,
      scrapGained: 150,
      intelGained: 5,
      timeSpent: 600,
      soldierResults: [],
    };

    screen.show(customReport);
    const buttons = Array.from(container.querySelectorAll(".debrief-button"));
    const replayBtn = buttons.find((b) => b.textContent === "REPLAY MISSION");
    expect(replayBtn).toBeDefined();

    const campaignReport: MissionReport = {
      nodeId: "node_1",
      seed: 12345,
      result: "Won",
      aliensKilled: 10,
      scrapGained: 150,
      intelGained: 5,
      timeSpent: 600,
      soldierResults: [],
    };

    screen.show(campaignReport);
    const buttons2 = Array.from(container.querySelectorAll(".debrief-button"));
    const replayBtn2 = buttons2.find((b) => b.textContent === "REPLAY MISSION");
    expect(replayBtn2).toBeUndefined();
  });

  it("should call onReplay when button is clicked", () => {
    const customReport: MissionReport = {
      nodeId: "custom",
      seed: 12345,
      result: "Won",
      aliensKilled: 10,
      scrapGained: 150,
      intelGained: 5,
      timeSpent: 600,
      soldierResults: [],
    };

    screen.show(customReport);
    const buttons = Array.from(container.querySelectorAll(".debrief-button"));
    const replayBtn = buttons.find(
      (b) => b.textContent === "REPLAY MISSION",
    ) as HTMLButtonElement;
    replayBtn.click();

    expect(onReplay).toHaveBeenCalled();
  });
});
