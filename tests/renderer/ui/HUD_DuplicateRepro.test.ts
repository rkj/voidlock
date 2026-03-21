// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HUDManager } from "@src/renderer/ui/HUDManager";
import { GameState, UnitState, MissionType } from "@src/shared/types";

describe("HUDManager Duplication Verification", () => {
  let hud: HUDManager;
  let mockMenuController: any;

  const mockState: GameState = {
    t: 1000,
    seed: 12345,
    missionType: MissionType.Default,
    status: "Playing",
    settings: {
      mode: "Simulation" as any,
      debugOverlayEnabled: false,
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
    map: { width: 10, height: 10, cells: [] },
    units: [],
    enemies: [],
    visibleCells: [],
    discoveredCells: [],
    loot: [],
    mines: [],
    turrets: [],
    objectives: [],
  };

  beforeEach(() => {
    // Setup minimal environment for HUDManager
    document.body.innerHTML = `
      <div id="screen-mission">
        <div id="mission-body"></div>
      </div>
    `;

    mockMenuController = {
      getRenderableState: vi.fn(() => ({
        title: "Actions",
        options: [{ key: "1", label: "1. Move", dataAttributes: { index: "1" } }],
      })),
    };

    hud = new HUDManager({
      menuController: mockMenuController,
      tutorialManager: { getCurrentStepId: () => null } as any,
      onUnitClick: vi.fn(),
      onAbortMission: // onUnitClick
      vi.fn(),
      onMenuInput: // onAbortMission
      vi.fn(),
      onCopyWorldState: // onMenuInput
      vi.fn(),
      onForceWin: // onCopyWorldState
      vi.fn(),
      onForceLose: // onForceWin
      vi.fn(),
      onStartMission: // onForceLose
      vi.fn(),
      onDeployUnit: // onStartMission
      vi.fn()
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should not duplicate controls when switching from Desktop to Mobile", () => {
    // 1. Start in Desktop mode
    // @ts-ignore
    window.innerWidth = 1024;
    hud.update(mockState, null);

    const rightPanel = document.getElementById("right-panel");
    const mobilePanel = document.getElementById("mobile-action-panel");
    
    expect(rightPanel?.querySelector(".mission-controls")).not.toBeNull();
    expect(mobilePanel?.querySelector(".mission-controls")).toBeNull();

    // 2. Switch to Mobile mode
    // @ts-ignore
    window.innerWidth = 500;
    hud.update(mockState, null);

    // Verify controls are now in mobile-action-panel
    expect(mobilePanel?.querySelector(".mission-controls")).not.toBeNull();
    expect(mobilePanel?.querySelector(".command-menu")).not.toBeNull();

    // FIXED: right-panel should no longer have the controls
    expect(rightPanel?.querySelector(".mission-controls")).toBeNull();
    expect(rightPanel?.querySelector(".command-menu")).toBeNull();
  });

  it("should not duplicate controls when switching from Mobile to Desktop", () => {
    // 1. Start in Mobile mode
    // @ts-ignore
    window.innerWidth = 500;
    hud.update(mockState, null);

    const rightPanel = document.getElementById("right-panel");
    const mobilePanel = document.getElementById("mobile-action-panel");
    
    expect(mobilePanel?.querySelector(".mission-controls")).not.toBeNull();
    expect(rightPanel?.querySelector(".mission-controls")).toBeNull();

    // 2. Switch to Desktop mode
    // @ts-ignore
    window.innerWidth = 1024;
    hud.update(mockState, null);

    // Verify controls are now in right-panel
    expect(rightPanel?.querySelector(".mission-controls")).not.toBeNull();

    // FIXED: mobile-action-panel should no longer have the controls
    expect(mobilePanel?.querySelector(".mission-controls")).toBeNull();
    expect(mobilePanel?.querySelector(".command-menu")).toBeNull();
  });

  it("should sync aria-hidden on right-panel for mobile devices", () => {
    // Switch to Mobile
    // @ts-ignore
    window.innerWidth = 500;
    hud.update(mockState, null);

    const rightPanel = document.getElementById("right-panel");
    
    // Default is drawer closed
    expect(rightPanel?.getAttribute("aria-hidden")).toBe("true");

    // Mock drawer open
    rightPanel?.classList.add("active");
    hud.update(mockState, null);
    expect(rightPanel?.getAttribute("aria-hidden")).toBe("false");

    // Switch back to Desktop
    // @ts-ignore
    window.innerWidth = 1024;
    hud.update(mockState, null);
    expect(rightPanel?.hasAttribute("aria-hidden")).toBe(false);
  });
});
