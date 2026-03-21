import { InputDispatcher } from "@src/renderer/InputDispatcher";
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DebriefScreen } from "@src/renderer/screens/DebriefScreen";
import { MissionReport } from "@src/shared/campaign_types";

describe("DebriefScreen", () => {
  let container: HTMLElement;
  let onContinue: any;
  let mockGameClient: any;
  let mockThemeManager: any;
  let mockAssetManager: any;
  let mockInputDispatcher: any;
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
    mockGameClient = {
  freezeForDialog: vi.fn(), unfreezeFromDialog: vi.fn(),
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
      resume: vi.fn(),
    };
    mockThemeManager = {
      getAssetUrl: vi.fn().mockReturnValue("mock-url"),
      getColor: vi.fn().mockReturnValue("#ffffff"),
      getCurrentThemeId: vi.fn().mockReturnValue("default"),
    };
    mockAssetManager = {
      iconImages: {},
      unitSprites: {},
      enemySprites: {},
      getMiscSprite: vi.fn(),
      getIcon: vi.fn(),
    };
    mockInputDispatcher = {
      pushContext: vi.fn(),
      popContext: vi.fn(),
    };

    screen = new DebriefScreen({
      containerId: "screen-debrief",
      gameClient: mockGameClient,
      themeManager: mockThemeManager as any,
      assetManager: mockAssetManager as any,
      inputDispatcher: mockInputDispatcher as any,
      onContinue: onContinue
    });
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
          id: "soldier_1",
          name: "Sgt. Slaughter",
          xpGained: 70,
          kills: 5,
          leveledUp: false,
          status: "Healthy",
          archetypeId: "assault",
          promoted: false,
          xpBefore: 0,
        },
      ],
    };

    screen.setReport(report);
    screen.show();

    expect(container.style.display).toBe("flex");
    expect(container.innerHTML).toContain("OPERATION CLOSED");
    expect(container.innerHTML).toContain("Targets Secured");
    expect(container.innerHTML).toContain("10"); // aliensKilled
  });

  it("should render failure report correctly", () => {
    const report: MissionReport = {
      nodeId: "node_1",
      seed: 12345,
      result: "Lost",
      aliensKilled: 5,
      scrapGained: 20,
      intelGained: 0,
      timeSpent: 300,
      soldierResults: [],
    };

    screen.setReport(report);
    screen.show();

    expect(container.innerHTML).toContain("OPERATION CLOSED");
    expect(container.innerHTML).toContain("Total Asset Loss");
  });

  it("should call onContinue when continue button is clicked", () => {
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

    screen.setReport(report);
    screen.show();

    const continueBtn = container.querySelector(".debrief-button") as HTMLElement;
    expect(continueBtn).not.toBeNull();
    continueBtn.click();

    expect(onContinue).toHaveBeenCalled();
  });
});
