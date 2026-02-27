// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DebriefScreen } from "@src/renderer/screens/DebriefScreen";
import { MissionReport } from "@src/shared/campaign_types";

describe("Regression: Replay speed UI mismatch (voidlock-pzzz)", () => {
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
  getTimeScale: vi.fn().mockReturnValue(1.0), // Initial scale in GameClient
      setTimeScale: vi.fn((speed: number) => {
        // Mock setTimeScale updating the target scale
        mockGameClient.getTargetScale = vi.fn(() => speed);
      }),
      getReplayData: vi.fn(() => ({})),
      loadReplay: vi.fn(),
      stop: vi.fn(),
      queryState: vi.fn(),
    };
    screen = new DebriefScreen("screen-debrief", mockGameClient, onContinue);
  });

  it("should cleanup renderer on destroy", () => {
    const canvas = document.createElement("canvas");
    (screen as any).canvas = canvas;
    screen.show({
      nodeId: "node_1",
      seed: 12345,
      result: "Won",
      aliensKilled: 10,
      scrapGained: 150,
      intelGained: 5,
      timeSpent: 600,
      soldierResults: [],
    });

    const replayController = (screen as any).replayController;
    expect(replayController.renderer).toBeTruthy();
    const rendererSpy = vi.spyOn(replayController.renderer, "destroy");

    screen.hide();
    expect(rendererSpy).toHaveBeenCalled();
    expect(replayController.renderer).toBeNull();
  });

  it("REPRODUCTION: should have 5x speed button active on initialization", () => {
    const report: MissionReport = {
      nodeId: "node_1",
      seed: 12345,
      result: "Won",
      aliensKilled: 10,
      scrapGained: 150,
      intelGained: 5,
      timeSpent: 600,
      soldierResults: [],
    };

    screen.show(report);

    const speedButtons = container.querySelectorAll(".replay-speed-btn");
    const fiveXButton = Array.from(speedButtons).find(
      (btn) => btn.textContent === "5x",
    ) as HTMLButtonElement;

    expect(fiveXButton).toBeTruthy();

    // THE BUG: This button should be active because startReplay sets speed to 5.0
    // But since render() is called before startReplay(), it's not active yet.
    expect(fiveXButton.classList.contains("active")).toBe(true);
  });
});
