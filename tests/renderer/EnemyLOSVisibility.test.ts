/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Renderer } from "@src/renderer/Renderer";
import {
  GameState,
  EngineMode,
} from "@src/shared/types";

describe("Enemy LOS Visibility", () => {
  let renderer: Renderer;
  let mockCanvas: HTMLCanvasElement;

  const mockGameState: GameState = {
    t: 0,
    status: "Active",
    stats: {
      aliensKilled: 0,
      casualties: 0,
      scrapGained: 0,
    },
    units: [
      {
        id: "s1",
        name: "Soldier 1",
        hp: 100,
        maxHp: 100,
        pos: { x: 1, y: 1 },
        tacticalNumber: 1,
        state: 0,
        stats: { speed: 1, soldierAim: 80, equipmentAccuracyBonus: 0 },
        activeCommand: null,
        commandQueue: [],
        rightHand: "pistol",
        leftHand: "combat_knife",
        activeWeaponId: "pistol",
        inventory: [],
        kills: 0,
        engagementPolicy: "ENGAGE",
      },
    ],
    enemies: [
      {
        id: "e0",
        type: "roamer",
        hp: 50,
        maxHp: 50,
        pos: { x: 5, y: 5 },
        state: 0,
        difficulty: 1,
        isAggro: false,
        isRevealed: true,
      },
    ],
    objectives: [],
    visibleCells: [
        "1,1", "1,2", "2,1"
    ],
    discoveredCells: [],
    loot: [],
    mines: [],
    turrets: [],
    squadInventory: {},
    map: { width: 10, height: 10, cells: [] },
    settings: {
      fogOfWarEnabled: true,
      debugOverlayEnabled: false,
      losOverlayEnabled: false,
      timeScale: 1,
      isPaused: false,
      mode: EngineMode.Simulation,
      isSlowMotion: false,
      allowTacticalPause: true,
      debugSnapshots: false,
    },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock getContext for canvas
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 10 }),
      drawImage: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      closePath: vi.fn(),
    }) as any;

    mockCanvas = document.createElement("canvas");
    renderer = new Renderer({
      canvas: mockCanvas,
      themeManager: { getColor: vi.fn().mockReturnValue("#fff"), getAssetUrl: vi.fn(), getIconUrl: vi.fn() } as any,
      assetManager: { 
        iconImages: {}, 
        unitSprites: {}, 
        enemySprites: {}, 
        getEnemySprite: vi.fn(), 
        getUnitSprite: vi.fn(), 
        getMiscSprite: vi.fn(), 
        getIcon: vi.fn() 
      } as any,
    });
    renderer.setCellSize(32);
  });

  it("should only render LOS for visible enemies", () => {
    const mockCtx = mockCanvas.getContext("2d")!;
    const fillTextSpy = vi.spyOn(mockCtx, "fillText");

    renderer.render(mockGameState);

    const renderedTexts = fillTextSpy.mock.calls.map((call) => call[0]);
    // Enemy at 5,5 is NOT in visibleCells, so it shouldn't render indicator
    expect(renderedTexts).not.toContain("A");

    // Reveal it
    const visibleState = {
        ...mockGameState,
        visibleCells: [...mockGameState.visibleCells, "5,5"]
    } as any;

    renderer.render(visibleState);
    const renderedTextsVisible = fillTextSpy.mock.calls.map((call) => call[0]);
    expect(renderedTextsVisible).toContain("A");
  });
});
