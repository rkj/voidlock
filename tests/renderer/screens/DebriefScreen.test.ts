// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DebriefScreen } from "@src/renderer/screens/DebriefScreen";
import type { MissionReport } from "@src/shared/campaign_types";
import { t } from "@src/renderer/i18n";
import { I18nKeys } from "@src/renderer/i18n/keys";

// Mock ConfigManager
vi.mock("@src/renderer/ConfigManager", () => ({
  ConfigManager: {
    loadGlobal: vi.fn().mockReturnValue({
      unitStyle: "TacticalIcons",
      themeId: "default",
      locale: "en-corporate",
    }),
  },
}));

describe("DebriefScreen", () => {
  let container: HTMLElement;
  let mockInputDispatcher: any;
  let mockGameClient: any;
  let mockThemeManager: any;
  let mockAssetManager: any;
  let screen: DebriefScreen;

  const mockReport: MissionReport = {
    nodeId: "node-1",
    seed: 12345,
    result: "Won",
    aliensKilled: 10,
    scrapGained: 150,
    intelGained: 5,
    timeSpent: 600,
    soldierResults: [
      {
        soldierId: "u1",
        name: "Sgt. Slaughter",
        xpBefore: 0,
        xpGained: 70,
        kills: 5,
        promoted: false,
        status: "Healthy",
      },
    ],
  };

  beforeEach(() => {
    container = document.createElement("div");
    container.id = "screen-debrief";
    container.innerHTML = '<canvas id="debrief-replay-canvas"></canvas>';
    document.body.appendChild(container);

    mockInputDispatcher = {
      pushContext: vi.fn(),
      popContext: vi.fn(),
    };

    mockGameClient = {
      replay: vi.fn(),
      getReplayData: vi.fn().mockReturnValue({ timeline: [] }),
      addStateUpdateListener: vi.fn(),
      removeStateUpdateListener: vi.fn(),
      setTimeScale: vi.fn(),
      loadReplay: vi.fn(),
      getIsPaused: vi.fn().mockReturnValue(false),
      getTargetScale: vi.fn().mockReturnValue(1.0),
    };

    mockThemeManager = {
      getCurrentThemeId: vi.fn().mockReturnValue("default"),
      getAssetUrl: vi.fn().mockReturnValue("mock-url"),
    };

    mockAssetManager = {};

    // Mock HTMLCanvasElement.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      drawImage: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      setLineDash: vi.fn(),
    });

    screen = new DebriefScreen({
      containerId: "screen-debrief",
      gameClient: mockGameClient,
      themeManager: mockThemeManager,
      assetManager: mockAssetManager,
      inputDispatcher: mockInputDispatcher,
      onContinue: vi.fn(),
    });
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should render success report correctly", () => {
    screen.show(mockReport);

    expect(container.style.display).toBe("flex");
    expect(container.innerHTML).toContain(t(I18nKeys.screen.debrief.header_success));
    expect(container.innerHTML).toContain(t(I18nKeys.screen.debrief.subheader_success));
    expect(container.innerHTML).toContain("10"); // aliensKilled
    expect(container.innerHTML).toContain("150"); // scrapGained
    expect(container.innerHTML).toContain("Sgt. Slaughter");
  });

  it("should render failure report correctly", () => {
    const failReport: MissionReport = { ...mockReport, result: "Lost" };
    screen.show(failReport);

    expect(container.innerHTML).toContain(t(I18nKeys.screen.debrief.header_failed));
    expect(container.innerHTML).toContain(t(I18nKeys.screen.debrief.subheader_failed));
  });

  it("should handle continue button click", () => {
    const onContinue = vi.fn();
    screen = new DebriefScreen({
      containerId: "screen-debrief",
      gameClient: mockGameClient,
      themeManager: mockThemeManager,
      assetManager: mockAssetManager,
      inputDispatcher: mockInputDispatcher,
      onContinue,
    });

    screen.show(mockReport);
    const continueBtn = container.querySelector(".debrief-button");
    (continueBtn as HTMLButtonElement)?.click();

    expect(onContinue).toHaveBeenCalled();
  });
});
