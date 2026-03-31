// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HUDManager } from "@src/renderer/ui/HUDManager";
import { GameState, UnitState, MissionType, AIProfile, EnemyType } from "@src/shared/types";
import { setLocale } from "@src/renderer/i18n";

describe("HUDManager Stats & Hostile Contact Intel", () => {
  let hud: HUDManager;
  let mockMenuController: any;

  const mockState: GameState = {
    t: 1000,
    seed: 12345,
    missionType: MissionType.Default,
    status: "Playing",
    units: [
      {
        id: "u1",
        name: "Unit 1",
        archetypeId: "assault",
        pos: { x: 1, y: 1 },
        hp: 100,
        maxHp: 100,
        state: UnitState.Idle,
        isDeployed: true,
        rightHand: "pulse_rifle",
        leftHand: "combat_knife",
        kills: 0,
        accuracy: 70,
        speed: 1.0,
        xp: 0,
        stats: {
          damage: 20,
          fireRate: 600,
          accuracy: 95,
          soldierAim: 90,
          attackRange: 10,
          speed: 20,
          equipmentAccuracyBonus: 0,
        },
        aiProfile: AIProfile.RUSH,
        commandQueue: [],
        positionHistory: [],
        innateMaxHp: 100,
        damageDealt: 0,
        objectivesCompleted: 0,
      },
    ],
    enemies: [],
    visibleCells: ["1,1"],
    map: {
      width: 10,
      height: 10,
      cells: [],
      squadSpawn: { x: 0, y: 0 },
      extraction: { x: 9, y: 9 },
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
      debugOverlayEnabled: false,
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

  it("should display soldier fire rate (FR)", () => {
    hud.update(mockState, "u1");
    const soldierList = document.getElementById("soldier-list");
    const soldierItem = soldierList?.querySelector(".soldier-item");
    
    // Check for Fire Rate in LH or RH stats
    const lhStats = soldierItem?.querySelector(".u-lh-stats");
    expect(lhStats?.innerHTML).toContain('title="Fire Rate"');
    // combat_knife fireRate: 400. 1000 / (400 * (30/20)) = 1000 / 600 = 1.666
    expect(lhStats?.innerHTML).toContain("1.7");
  });

  it("should display all requested soldier stats", () => {
    hud.update(mockState, "u1");
    const item = document.querySelector(".soldier-item")!;
    
    // Check RH stats for pulse_rifle
    const rhStats = item.querySelector(".u-rh-stats");
    expect(rhStats?.innerHTML).toContain('title="Damage"');
    expect(rhStats?.innerHTML).toContain("20");
    expect(rhStats?.innerHTML).toContain('title="Accuracy"');
    expect(rhStats?.innerHTML).toContain("95"); // soldierAim 90 + pulse_rifle mod 5
    expect(rhStats?.innerHTML).toContain('title="Fire Rate"');
    expect(rhStats?.innerHTML).toContain("1.1"); // 1000 / (600 * (30/20)) = 1.111
    expect(rhStats?.innerHTML).toContain('title="Range"');
    expect(rhStats?.innerHTML).toContain("10");
  });

  it("should display hostile contact intel for visible enemies", () => {
    const stateWithEnemies: GameState = {
      ...mockState,
      visibleCells: ["1,1", "5,5"],
      enemies: [
        {
          id: "e1",
          type: EnemyType.XenoMite,
          pos: { x: 5, y: 5 },
          hp: 10,
          maxHp: 10,
          state: "Idle",
          damage: 15,
          fireRate: 500,
          accuracy: 50,
          attackRange: 1,
          speed: 30
        } as any
      ]
    };

    hud.update(stateWithEnemies, null);

    const intelDiv = document.querySelector(".enemy-intel");
    expect(intelDiv).not.toBeNull();
    expect(intelDiv?.innerHTML).toContain("Enemy Intel");
    expect(intelDiv?.innerHTML).toContain("xeno-mite x1");
    
    expect(intelDiv?.innerHTML).toContain('title="Speed"');
    expect(intelDiv?.innerHTML).toContain("30");
    expect(intelDiv?.innerHTML).toContain('title="Damage"');
    expect(intelDiv?.innerHTML).toContain("15");
  });

  it("should show 'No hostiles detected' when no enemies are visible", () => {
    hud.update(mockState, null);

    const intelDiv = document.querySelector(".enemy-intel");
    expect(intelDiv?.innerHTML).toContain("No Hostiles Detected.");
  });
});
