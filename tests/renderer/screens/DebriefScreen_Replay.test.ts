// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DebriefScreen } from "@src/renderer/screens/DebriefScreen";
import { MissionReport } from "@src/shared/campaign_types";
import { UnitStyle } from "@src/shared/types";

describe("DebriefScreen Replay Button", () => {
  let container: HTMLElement;
  let onContinue: any;
  let onReplay: any;
  let mockGameClient: any;
  let mockTheme: any;
  let mockAssets: any;
  let mockInput: any;
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
      setLineDash: vi.fn(),
      measureText: vi.fn(() => ({ width: 0 })),
      fillText: vi.fn(),
    } as any);

    document.body.innerHTML = '<div id="screen-debrief"></div>';
    container = document.getElementById("screen-debrief")!;
    onContinue = vi.fn();
    onReplay = vi.fn();
    mockGameClient = {
  freezeForDialog: vi.fn(), unfreezeFromDialog: vi.fn(),
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
      queryState: vi.fn(),
      resume: vi.fn(),
    };
    mockTheme = {
      getAssetUrl: vi.fn().mockReturnValue("mock-url"),
      getColor: vi.fn().mockReturnValue("#ffffff"),
      getCurrentThemeId: vi.fn().mockReturnValue("default"),
    };
    mockAssets = {
      iconImages: {},
      unitSprites: {},
      enemySprites: {},
      getMiscSprite: vi.fn(),
      getIcon: vi.fn(),
    };
    mockInput = {
      pushContext: vi.fn(),
      popContext: vi.fn(),
    };

    screen = new DebriefScreen({
      containerId: "screen-debrief",
      gameClient: mockGameClient,
      themeManager: mockTheme as any,
      assetManager: mockAssets as any,
      inputDispatcher: mockInput as any,
      onContinue: onContinue,
      onReplay: onReplay
    });
  });

  it("should show Replay button only for custom missions", () => {
    const report: MissionReport = {
      nodeId: "custom",
      seed: 12345,
      result: "Won",
      aliensKilled: 10,
      scrapGained: 150,
      intelGained: 5,
      timeSpent: 600,
      soldierResults: [],
    };

    screen.setReport(report);
    screen.show();

    // Custom missions have a special replay button in the summary pane
    const replayBtn = Array.from(container.querySelectorAll(".debrief-button")).find(b => b.textContent?.includes("Analyze Tactical Feed"));
    expect(replayBtn).not.toBeNull();
    expect(replayBtn?.textContent).toContain("Analyze Tactical Feed");
  });

  it("should call onReplay when button is clicked", () => {
    const report: MissionReport = {
      nodeId: "custom",
      seed: 12345,
      result: "Won",
      aliensKilled: 10,
      scrapGained: 150,
      intelGained: 5,
      timeSpent: 600,
      soldierResults: [],
    };

    screen.setReport(report);
    screen.show();

    const replayBtn = Array.from(container.querySelectorAll(".debrief-button")).find(b => b.textContent?.includes("Analyze Tactical Feed")) as HTMLElement;
    expect(replayBtn).not.toBeNull();
    replayBtn.click();

    expect(onReplay).toHaveBeenCalled();
  });

  it("should call destroy on ReplayController when hidden", () => {
    const report: MissionReport = {
      nodeId: "custom",
      seed: 12345,
      result: "Won",
      aliensKilled: 0,
      scrapGained: 0,
      intelGained: 0,
      timeSpent: 100,
      soldierResults: [],
    };
    screen.setReport(report);
    screen.show();
    const controller = (screen as any).replayController;
    const destroySpy = vi.spyOn(controller, "destroy");

    screen.hide();
    expect(destroySpy).toHaveBeenCalled();
  });

  it("should call gameClient.stop on ReplayController.destroy only if replay was active", () => {
    const report: MissionReport = {
      nodeId: "custom",
      seed: 12345,
      result: "Won",
      aliensKilled: 0,
      scrapGained: 0,
      intelGained: 0,
      timeSpent: 100,
      soldierResults: [],
    };
    screen.setReport(report);
    screen.show();
    const controller = (screen as any).replayController;
    const stopSpy = vi.spyOn(mockGameClient, "stop");

    // Mock replay inactive
    (controller as any).isReplaying = false;
    controller.destroy();
    expect(stopSpy).not.toHaveBeenCalled();

    // Mock replay active
    (controller as any).isReplaying = true;
    controller.destroy();
    expect(stopSpy).toHaveBeenCalled();
  });
});
