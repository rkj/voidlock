// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DebriefScreen } from "@src/renderer/screens/DebriefScreen";
import { MissionReport } from "@src/shared/campaign_types";

describe("DebriefScreen Visual Audit", () => {
  let container: HTMLElement;
  let onContinue: any;
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
      onContinue: onContinue
    });
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
          id: "s1",
          name: "Sgt. Mock",
          archetypeId: "assault",
          kills: 5,
          status: "Healthy",
          xpGained: 100,
          leveledUp: false,
          promoted: false,
          xpBefore: 0,
        },
      ],
    };

    screen.setReport(report);
    screen.show();

    // Check for spec-compliant classes
    expect(container.querySelector(".debrief-container")).not.toBeNull();
    expect(container.querySelector(".debrief-summary")).not.toBeNull();
    expect(container.querySelector(".debrief-replay-viewport")).not.toBeNull();
    expect(container.querySelector(".debrief-panel")).not.toBeNull();
    expect(container.querySelector(".scroll-content")).not.toBeNull();
  });

  it("should render 4 soldiers without issues", () => {
    const report: MissionReport = {
      nodeId: "node_1",
      seed: 12345,
      result: "Won",
      aliensKilled: 10,
      scrapGained: 150,
      intelGained: 5,
      timeSpent: 600,
      soldierResults: [
        { id: "s1", name: "S1", archetypeId: "assault", kills: 1, status: "Healthy", xpGained: 10, leveledUp: false, promoted: false, xpBefore: 0 },
        { id: "s2", name: "S2", archetypeId: "assault", kills: 1, status: "Healthy", xpGained: 10, leveledUp: false, promoted: false, xpBefore: 0 },
        { id: "s3", name: "S3", archetypeId: "assault", kills: 1, status: "Healthy", xpGained: 10, leveledUp: false, promoted: false, xpBefore: 0 },
        { id: "s4", name: "S4", archetypeId: "assault", kills: 1, status: "Healthy", xpGained: 10, leveledUp: false, promoted: false, xpBefore: 0 },
      ],
    };

    screen.setReport(report);
    screen.show();

    const widgets = container.querySelectorAll(".soldier-widget");
    expect(widgets.length).toBe(4);
  });
});
