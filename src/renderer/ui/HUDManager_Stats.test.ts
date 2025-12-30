// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HUDManager } from "./HUDManager";
import { GameState, UnitState, Unit, Enemy } from "../../shared/types";

describe("HUDManager Stats & Enemy Intel", () => {
  let hud: HUDManager;
  let mockMenuController: any;
  let onUnitClick: any;
  let onAbortMission: any;
  let onMenuInput: any;

  const mockState: GameState = {
    t: 1000,
    status: "Playing",
    threatLevel: 25,
    aliensKilled: 5,
    casualties: 0,
    map: { width: 10, height: 10, cells: [] },
    units: [
      {
        id: "s1",
        hp: 100,
        maxHp: 100,
        state: UnitState.Idle,
        accuracy: 90,
        damage: 20,
        fireRate: 500, // 2 shots per second
        attackRange: 4,
        speed: 20,
        sightRange: 10,
        engagementPolicy: "ENGAGE",
        archetypeId: "assault",
        commandQueue: [],
      } as any,
    ],
    enemies: [
      {
        id: "e1",
        type: "Xeno-Mite",
        pos: { x: 5.5, y: 5.5 },
        hp: 50,
        maxHp: 50,
        damage: 15,
        fireRate: 800,
        accuracy: 50,
        attackRange: 1,
        speed: 30,
      } as any,
    ],
    visibleCells: ["5,5"],
    discoveredCells: ["5,5"],
    objectives: [],
  };

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

    hud = new HUDManager(
      mockMenuController,
      onUnitClick,
      onAbortMission,
      onMenuInput,
      "1.0.0",
    );
  });

  it("should display soldier fire rate (FR)", () => {
    hud.update(mockState, null);

    const soldierItem = document.querySelector(".soldier-item");
    const frEl = soldierItem?.querySelector(".u-firerate");
    expect(frEl?.textContent).toBe("2.0");
  });

  it("should display all requested soldier stats", () => {
    hud.update(mockState, null);

    const item = document.querySelector(".soldier-item")!;
    expect(item.querySelector(".u-speed")?.textContent).toBe("2.0");
    expect(item.querySelector(".u-acc")?.textContent).toBe("90");
    expect(item.querySelector(".u-dmg")?.textContent).toBe("20");
    expect(item.querySelector(".u-firerate")?.textContent).toBe("2.0");
  });

  it("should display enemy intel for visible enemies", () => {
    hud.update(mockState, null);

    const intelDiv = document.querySelector(".enemy-intel");
    expect(intelDiv).not.toBeNull();
    expect(intelDiv?.innerHTML).toContain("Enemy Intel");
    expect(intelDiv?.innerHTML).toContain("Xeno-Mite x1");

    // Check stats
    expect(intelDiv?.innerHTML).toContain(
      'SPD:<span style="color:#eee">3.0</span>',
    );
    expect(intelDiv?.innerHTML).toContain(
      'ACC:<span style="color:#eee">50</span>',
    );
    expect(intelDiv?.innerHTML).toContain(
      'MDMG:<span style="color:#eee">15</span>',
    );
    expect(intelDiv?.innerHTML).toContain(
      'FR:<span style="color:#eee">1.3</span>',
    ); // 1000/800 = 1.25 -> 1.3
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
    expect(intelDiv?.innerHTML).toContain("Xeno-Mite x2");
  });
});
