// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HUDManager } from "@src/renderer/ui/HUDManager";
import { MissionType } from "@src/shared/types";
import { t } from "@src/renderer/i18n";
import { I18nKeys } from "@src/renderer/i18n/keys";

describe("HUDManager Debug Info Regression (voidlock-6gl)", () => {
  let hud: HUDManager;
  let mockState: any;

  beforeEach(() => {
    document.body.innerHTML =
      '<div id="screen-mission"><div id="mission-body"></div></div>';

    hud = new HUDManager({
      menuController: { getRenderableState: () => ({ title: "Debug", options: [] }) } as any,
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

    mockState = {
      t: 1000,
      seed: 98765,
      missionType: MissionType.EscortVIP,
      status: "Playing",
      settings: {
        debugOverlayEnabled: true,
        debugSnapshots: false,
        losOverlayEnabled: false,
        timeScale: 1.0,
        isPaused: false,
        isSlowMotion: false,
        allowTacticalPause: true,
      },
      squadInventory: {},
      stats: {
        threatLevel: 25,
        aliensKilled: 0,
        elitesKilled: 0,
        casualties: 0,
        scrapGained: 0,
      },
      map: { width: 32, height: 24, cells: [], generatorName: "Unknown" },
      units: [],
      enemies: [],
      visibleCells: [],
      discoveredCells: [],
      loot: [],
      mines: [],
      turrets: [],
      objectives: [],
    };
  });

  it("should display Map Info (with seed), Map Size, and Mission Type in debug tools", () => {
    hud.update(mockState, null);

    const debugDiv = document.querySelector(".debug-controls");
    expect(debugDiv).not.toBeNull();

    const text = debugDiv?.textContent || "";
    // Note: t() returns different strings based on locale, but since we are in test environment 
    // it usually defaults to en-corporate or en-standard.
    // We use t() in expectations to match whatever the current locale is.
    expect(text).toContain(`${t(I18nKeys.hud.debug.map)} UnknownGenerator (98765)`);
    expect(text).toContain(`${t(I18nKeys.hud.debug.size)} 32x24`);
    expect(text).toContain(`${t(I18nKeys.hud.debug.mission)} EscortVIP`);
  });
});
