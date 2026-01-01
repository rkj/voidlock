// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HUDManager } from "./HUDManager";
import { GameState, UnitState } from "../../shared/types";
import {
  createMockGameState,
  createMockUnit,
} from "../../engine/tests/utils/MockFactory";

describe("HUDManager Regression kvi1", () => {
  let hud: HUDManager;
  let mockMenuController: any;
  let onUnitClick: any;
  let onAbortMission: any;
  let onMenuInput: any;

  const mockState: GameState = createMockGameState({
    t: 1000,
    status: "Playing",
    stats: {
      threatLevel: 25,
      aliensKilled: 5,
      casualties: 0,
    },
    map: { width: 10, height: 10, cells: [] },
    units: [
      createMockUnit({
        id: "s1",
        hp: 100,
        maxHp: 100,
        state: UnitState.Idle,
        stats: {
          accuracy: 80,
          damage: 10,
          attackRange: 10,
          speed: 20,
          soldierAim: 80,
          equipmentAccuracyBonus: 0,
          fireRate: 500,
        },
        engagementPolicy: "ENGAGE",
      }),
    ],
    enemies: [],
    visibleCells: [],
    discoveredCells: [],
    objectives: [],
  });

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="game-status"></div>
      <div id="version-display"></div>
      <div id="menu-version"></div>
      <div id="top-threat-fill"></div>
      <div id="top-threat-value"></div>
      <div id="right-panel"></div>
      <div id="soldier-list"></div>
    `;

    mockMenuController = {
      getRenderableState: vi.fn(() => ({
        title: "ACTIONS",
        options: [
          { key: "1", label: "1. MOVE", dataAttributes: { index: "1" } },
        ],
      })),
    };
    onUnitClick = vi.fn();
    onAbortMission = vi.fn();
    onMenuInput = vi.fn();

    hud = new HUDManager(
      mockMenuController,
      onUnitClick,
      onAbortMission,
      onMenuInput,
      "1.0.0",
    );
  });

  it("should repopulate command menu after right panel is cleared (mission restart)", () => {
    // 1. Initial mission start
    hud.update(mockState, null);

    let menuDiv = document.querySelector(".command-menu") as HTMLElement;
    expect(menuDiv).not.toBeNull();
    expect(menuDiv.innerHTML).toContain("1. MOVE");

    // 2. Simulate mission end/restart by clearing right-panel (as done in main.ts)
    const rightPanel = document.getElementById("right-panel");
    if (rightPanel) rightPanel.innerHTML = "";

    // 3. Second mission start
    hud.update(mockState, null);

    menuDiv = document.querySelector(".command-menu") as HTMLElement;
    expect(menuDiv).not.toBeNull();
    // THIS IS EXPECTED TO FAIL if the bug exists
    expect(menuDiv.innerHTML).toContain("1. MOVE");
  });
});
