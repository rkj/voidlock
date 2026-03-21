import { describe, it, expect, beforeEach, vi } from "vitest";
import { GameRenderer } from "@src/renderer/visuals/GameRenderer";
import { GameState, CellType, UnitState, UnitStyle } from "@src/shared/types";
import {
  createMockUnit,
  createMockGameState,
} from "@src/engine/tests/utils/MockFactory";

// Mock Image
class MockImage {
  onload: (() => void) | null = null;
  src: string = "";
  complete: boolean = true;
}
vi.stubGlobal("Image", MockImage);

describe("Layer Rendering Order", () => {
  let renderer: GameRenderer;
  let mockCanvas: HTMLCanvasElement;
  let mockContext: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    mockContext = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      drawImage: vi.fn(),
      createRadialGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      getContext: vi.fn(() => mockContext),
      measureText: vi.fn(() => ({ width: 0 })),
    };

    mockCanvas = {
      getContext: vi.fn(() => mockContext),
      width: 0,
      height: 0,
      getBoundingClientRect: vi.fn(() => ({
        left: 0,
        top: 0,
        width: 640,
        height: 480,
      })),
    } as unknown as HTMLCanvasElement;

    const mockThemeManager = {
      getAssetUrl: vi.fn().mockReturnValue("mock-asset-url"),
      getColor: vi.fn().mockReturnValue("#ffffff"),
    };
    const mockImage = {
      complete: true,
      naturalWidth: 100,
      naturalHeight: 100,
    };
    const mockAssetManager = {
      iconImages: {},
      unitSprites: {},
      enemySprites: {},
      getMiscSprite: vi.fn().mockReturnValue(mockImage),
      getUnitSprite: vi.fn().mockReturnValue(mockImage),
      getEnemySprite: vi.fn().mockReturnValue(mockImage),
    };

    renderer = new GameRenderer({
      canvas: mockCanvas,
      themeManager: mockThemeManager as any,
      assetManager: mockAssetManager as any
    });
    renderer.setUnitStyle(UnitStyle.Sprites);
    renderer.setCellSize(32);
  });

  it("should render UnitLayer (units) AFTER MapEntityLayer (spawn points)", () => {
    const gameState: GameState = createMockGameState({
      map: {
        width: 2,
        height: 2,
        cells: [{ x: 0, y: 0, type: CellType.Floor }],
        spawnPoints: [{ pos: { x: 0, y: 0 }, id: "sp1", radius: 1 }],
      },
      units: [
        createMockUnit({
          id: "u1",
          pos: { x: 0.5, y: 0.5 },
          state: UnitState.Idle,
        }),
      ],
      loot: [{ id: "l1", itemId: "medkit", pos: { x: 0, y: 0 } }],
      visibleCells: ["0,0"],
      discoveredCells: ["0,0"],
    });

    renderer.render(gameState);

    const calls: { name: string; order: number; args: unknown[] }[] = [];
    Object.keys(mockContext).forEach((key) => {
      const mock = mockContext[key];
      if (mock && typeof mock === "function" && (mock as any).mock) {
        (mock as any).mock.calls.forEach((args: unknown[], i: number) => {
          calls.push({
            name: key,
            order: (mock as any).mock.invocationCallOrder[i],
            args,
          });
        });
      }
    });
    calls.sort((a, b) => a.order - b.order);
    console.log("Context calls:", calls.map(c => `${c.name} (order ${c.order})`));

    // We want to check the order of calls to the context.
    // MapEntityLayer uses arc()/fill() (for spawn bg) and drawImage() (for spawn icon)
    // UnitLayer uses drawImage() (for sprite unit) or arc() (for tactical icon unit)

    const drawImageCalls = calls.filter((c) => c.name === "drawImage");
    
    // First drawImage is for the spawn point sprite (Standard mode)
    const spawnIconCall = drawImageCalls.find(c => c.order > 0);
    const spawnIconIndex = spawnIconCall ? spawnIconCall.order : -1;

    // Second drawImage is for the unit sprite
    const unitSpriteCall = drawImageCalls.find(c => c.order > spawnIconIndex);
    const unitSpriteIndex = unitSpriteCall ? unitSpriteCall.order : -1;

    expect(spawnIconIndex).not.toBe(-1);
    expect(unitSpriteIndex).not.toBe(-1);

    // Spawn point should be drawn before the unit
    expect(unitSpriteIndex).toBeGreaterThan(spawnIconIndex);
  });
});
