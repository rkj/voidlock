// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HUDManager } from "@src/renderer/ui/HUDManager";
import { GameState, UnitState, EnemyType } from "@src/shared/types";
import {
  createMockGameState,
  createMockUnit,
  createMockEnemy,
} from "@src/engine/tests/utils/MockFactory";

describe("HUDManager Stats & Enemy Intel", () => {
  let hud: HUDManager;
  let mockMenuController: any;
  let onUnitClick: any;
  let onAbortMission: any;
  let onMenuInput: any;
  let onCopyWorldState: any;

  const mockState: GameState = createMockGameState({
    t: 1000,
    status: "Playing",
    stats: {
      threatLevel: 0,
      aliensKilled: 0,
      elitesKilled: 0,
      casualties: 0,
      scrapGained: 0,
    },
    map: { width: 10, height: 10, cells: [] },
    units: [
      createMockUnit({
        id: "s1",
        hp: 100,
        maxHp: 100,
        state: UnitState.Idle,
        stats: {
          accuracy: 90,
          damage: 20,
          fireRate: 500, // 2 shots per second
          attackRange: 10,
          speed: 20,
          soldierAim: 80,
          equipmentAccuracyBonus: 0,
        },
        engagementPolicy: "ENGAGE",
        archetypeId: "assault",
        leftHand: "combat_knife",
        rightHand: "pulse_rifle",
        commandQueue: [],
      }),
    ],
    enemies: [
      createMockEnemy({
        id: "e1",
        type: EnemyType.XenoMite,
        pos: { x: 5.5, y: 5.5 },
        hp: 50,
        maxHp: 50,
        damage: 15,
        fireRate: 800,
        accuracy: 50,
        attackRange: 1,
        speed: 30,
        difficulty: 1,
      }),
    ],
    visibleCells: ["5,5"],
    discoveredCells: ["5,5"],
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
        options: [],
      })),
    };
    onUnitClick = vi.fn();
    onAbortMission = vi.fn();
    onMenuInput = vi.fn();
    onCopyWorldState = vi.fn();

    hud = new HUDManager(
      mockMenuController,
      onUnitClick,
      onAbortMission,
      onMenuInput,
      onCopyWorldState,
      vi.fn(),
      vi.fn(),
    );
  });

  it("should display soldier fire rate (FR)", () => {
    hud.update(mockState, null);

    const soldierItem = document.querySelector(".soldier-item");
    // Check for Fire Rate in LH or RH stats
    const lhStats = soldierItem?.querySelector(".u-lh-stats");
    expect(lhStats?.innerHTML).toContain('title="Fire Rate"');
    // combat_knife fireRate: 400. 1000 / (400 * (10/20)) = 1000 / 200 = 5.0
    expect(lhStats?.innerHTML).toContain("5.0");
  });

  it("should display all requested soldier stats", () => {
    hud.update(mockState, null);

    const item = document.querySelector(".soldier-item")!;
    // Speed is in base-stats-row
    const speedBox = item.querySelector(".u-speed-box");
    expect(speedBox?.innerHTML).toContain('title="Speed"');
    expect(speedBox?.textContent?.trim()).toBe("20");

    // Check RH stats for pulse_rifle
    const rhStats = item.querySelector(".u-rh-stats");
    expect(rhStats?.innerHTML).toContain('title="Damage"');
    expect(rhStats?.innerHTML).toContain("20");
    expect(rhStats?.innerHTML).toContain('title="Accuracy"');
    // soldierAim 80 + pulse_rifle accuracy 5 = 85
    expect(rhStats?.innerHTML).toContain("85");
  });

  it("should display enemy intel for visible enemies", () => {
    hud.update(mockState, null);

    const intelDiv = document.querySelector(".enemy-intel");
    expect(intelDiv).not.toBeNull();
    expect(intelDiv?.innerHTML).toContain("Enemy Intel");
    expect(intelDiv?.innerHTML).toContain("xeno-mite x1");

    // Check stats using titles
    expect(intelDiv?.innerHTML).toContain('title="Speed"');
    expect(intelDiv?.innerHTML).toContain("30");
    expect(intelDiv?.innerHTML).toContain('title="Accuracy"');
    expect(intelDiv?.innerHTML).toContain("50");
    expect(intelDiv?.innerHTML).toContain('title="Damage"');
    expect(intelDiv?.innerHTML).toContain("15");
    expect(intelDiv?.innerHTML).toContain('title="Fire Rate"');
    expect(intelDiv?.innerHTML).toContain("1.3"); // 1000/800 = 1.25 -> 1.3
  });

  it("should show 'No hostiles detected' when no enemies are visible", () => {
    const blindState = { ...mockState, visibleCells: [] };
    hud.update(blindState, null);

    const intelDiv = document.querySelector(".enemy-intel");
    expect(intelDiv?.innerHTML).toContain("No hostiles detected.");
  });

  it("should update enemy count when multiple of same type are visible", () => {
    const multiState = {
      ...mockState,
      enemies: [...mockState.enemies, { ...mockState.enemies[0], id: "e2" }],
      visibleCells: ["5,5"],
    };
    hud.update(multiState, null);

    const intelDiv = document.querySelector(".enemy-intel");
    expect(intelDiv?.innerHTML).toContain("xeno-mite x2");
  });
});
