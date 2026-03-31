// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HUDManager } from "@src/renderer/ui/HUDManager";
import { GameState, MissionType } from "@src/shared/types";
import { setLocale, t } from "@src/renderer/i18n";
import { I18nKeys } from "@src/renderer/i18n/keys";

describe("HUDManager Debug Info Regression (voidlock-6gl)", () => {
  let hud: HUDManager;
  let mockMenuController: any;

  const mockState: GameState = {
    t: 1000,
    seed: 98765,
    missionType: MissionType.EscortVIP,
    status: "Playing",
    units: [],
    enemies: [],
    visibleCells: [],
    map: {
      width: 32,
      height: 24,
      cells: [],
      squadSpawn: { x: 0, y: 0 },
      extraction: { x: 31, y: 23 },
      generatorName: "Unknown",
    },
    objectives: [],
    stats: {
      threatLevel: 0,
      aliensKilled: 0,
      casualties: 0,
      totalCredits: 0,
      missionsPlayed: 0,
      missionsWon: 0,
    },
    settings: {
      allowTacticalPause: true,
      debugOverlayEnabled: true,
      isPaused: false,
      targetTimeScale: 1.0,
      timeScale: 1.0,
    },
    commandLog: [],
  };

  beforeEach(() => {
    setLocale("en-standard");
    document.body.innerHTML = '<div id="screen-mission"><div id="mission-body"></div></div>';
    
    mockMenuController = {
      getRenderableState: vi.fn().mockReturnValue({ title: "Test", options: [] }),
    };

    hud = new HUDManager({
      menuController: mockMenuController,
      tutorialManager: null,
      onUnitClick: vi.fn(),
      onAbortMission: vi.fn(),
      onMenuInput: vi.fn(),
      onCopyWorldState: vi.fn(),
      onForceWin: vi.fn(),
      onForceLose: vi.fn(),
      onStartMission: vi.fn(),
      onDeployUnit: vi.fn(),
    });
  });

  it("should display Map Info (with seed), Map Size, and Mission Type in debug tools", () => {
    hud.update(mockState, null);

    const debugDiv = document.querySelector(".debug-controls");
    expect(debugDiv).not.toBeNull();
    
    const text = debugDiv?.textContent || "";
    
    // Check Map Info
    expect(text).toContain(`${t(I18nKeys.hud.debug.map)} UnknownGenerator (98765)`);
    
    // Check Map Size
    expect(text).toContain(`${t(I18nKeys.hud.debug.size)} 32x24`);
    
    // Check Mission Type
    expect(text).toContain(`${t(I18nKeys.hud.debug.mission)} VIP Protection`);
  });
});
