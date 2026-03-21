// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Renderer } from "@src/renderer/Renderer";
import { GameState, EnemyType, UnitStyle, CellType, MissionType } from "@src/shared/types";
import { createMockUnit, createMockEnemy, createMockGameState } from "@src/engine/tests/utils/MockFactory";

describe("Renderer", () => {
  let canvas: HTMLCanvasElement;
  let renderer: Renderer;
  let mockContext: any;
  let mockCanvas: any;

  const mockGameState: GameState = createMockGameState({
    t: 100,
    seed: 123,
    map: {
      width: 10,
      height: 10,
      cells: [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 1, y: 1, type: CellType.Floor },
      ],
      spawnPoints: [{ pos: { x: 0, y: 0 }, id: "sp1", radius: 1 }],
      extraction: { x: 9, y: 9 },
    },
    units: [
      createMockUnit({
        id: "u1",
        pos: { x: 0.5, y: 0.5 },
        hp: 100,
        maxHp: 100,
        stats: {
          hp: 100,
          attackRange: 5,
          damage: 10,
          fireRate: 500,
          speed: 2,
          accuracy: 95,
          soldierAim: 90,
          equipmentAccuracyBonus: 0,
        },
        commandQueue: [],
        archetypeId: "assault",
      }),
    ],
    enemies: [
      createMockEnemy({
        id: "e1",
        pos: { x: 1.5, y: 1.5 },
        hp: 50,
        maxHp: 50,
        type: EnemyType.SwarmMelee,
        stats: {
          hp: 50,
          damage: 10,
          fireRate: 1000,
          attackRange: 1,
          speed: 2,
        },
      }), // Visible
      createMockEnemy({
        id: "e2",
        pos: { x: 8.5, y: 8.5 },
        hp: 30,
        maxHp: 30,
        type: EnemyType.SwarmMelee,
        stats: {
          hp: 30,
          damage: 10,
          fireRate: 1000,
          attackRange: 1,
          speed: 2,
        },
      }), // Hidden by fog
    ],
    visibleCells: ["0,0", "1,1", "1,0", "0,1"],
    discoveredCells: ["0,0", "1,1"],
    missionStats: {
      aliensKilled: 0,
      timeSpent: 100,
      casualties: 0,
      scrapGained: 0,
    },
    status: "Playing",
  });

  let mockThemeManager: any;
  let mockAssetManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      fillText: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
      setLineDash: vi.fn(),
      createRadialGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      measureText: vi.fn(() => ({ width: 0 })),
    };

    mockCanvas = {
      getContext: vi.fn(() => mockContext),
      width: 800,
      height: 600,
      getBoundingClientRect: vi.fn(() => ({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
      })),
    };

    mockThemeManager = {
      getAssetUrl: vi.fn().mockReturnValue("mock-asset-url"),
      getColor: vi.fn().mockReturnValue("#ffffff"),
      getCurrentThemeId: vi.fn().mockReturnValue("default"),
    };
    mockAssetManager = {
      iconImages: {},
      unitSprites: {},
      enemySprites: {},
      getUnitSprite: vi.fn(),
      getEnemySprite: vi.fn(),
      getMiscSprite: vi.fn(),
      getIcon: vi.fn(),
    };
    renderer = new Renderer({
      canvas: mockCanvas as any,
      themeManager: mockThemeManager as any,
      assetManager: mockAssetManager as any
    });
    renderer.setCellSize(32);
  });

  it("should render map, fog, and entities", () => {
    renderer.render(mockGameState);
    expect(mockContext.clearRect).toHaveBeenCalled();
    expect(mockContext.fillRect).toHaveBeenCalled();
  });

  it("should only render visible enemies", () => {
    renderer.render(mockGameState);
    // e1 is visible, e2 is hidden
    // total enemies = 2, only 1 is visible
    // Note: '1' is drawn for the unit, then 'B' for the visible enemy (id 'e1' -> 1 -> 'B')
    expect(mockContext.fillText).toHaveBeenCalledWith("1", expect.any(Number), expect.any(Number));
    expect(mockContext.fillText).toHaveBeenCalledWith("B", expect.any(Number), expect.any(Number));
    expect(mockContext.fillText).not.toHaveBeenCalledWith("C", expect.any(Number), expect.any(Number));
  });

  it("should render combat tracers", () => {
    const stateWithTracer = {
      ...mockGameState,
      events: [
        {
          type: "Attack",
          attackerId: "u1",
          targetId: "e1",
          attackerPos: { x: 0.5, y: 0.5 },
          targetPos: { x: 1.5, y: 1.5 },
          weaponId: "pulse_rifle",
          damage: 10,
          hit: true,
          t: 100,
        },
      ],
    };
    renderer.render(stateWithTracer as any);
    expect(mockContext.beginPath).toHaveBeenCalled();
    expect(mockContext.stroke).toHaveBeenCalled();
  });

  it("should render overlay options with labels", () => {
    renderer.setOverlay([
      {
        id: "opt1",
        pos: { x: 2, y: 2 },
        label: "Option 1",
        color: "#ff0000",
        renderOnBoard: true,
      },
    ]);
    renderer.render(mockGameState);
    expect(mockContext.fillText).toHaveBeenCalledWith("Option 1", expect.any(Number), expect.any(Number));
  });

  it("should render debug overlay when enabled", () => {
    const stateWithDebug = {
      ...mockGameState,
      settings: {
        debugOverlayEnabled: true,
        losOverlayEnabled: false,
      },
    };
    renderer.render(stateWithDebug as any);
    // Debug overlay draws grid coordinates
    expect(mockContext.fillText).toHaveBeenCalled();
  });

  it("should render LOS overlay when enabled", () => {
    const stateWithLOS = {
      ...mockGameState,
      settings: {
        debugOverlayEnabled: false,
        losOverlayEnabled: true,
      },
    };
    renderer.render(stateWithLOS as any);
    expect(mockContext.createRadialGradient).toHaveBeenCalled();
  });
});
