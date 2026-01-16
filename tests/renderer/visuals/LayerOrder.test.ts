import { describe, it, expect, beforeEach, vi } from "vitest";
import { GameRenderer } from "@src/renderer/visuals/GameRenderer";
import {
  GameState,
  CellType,
  UnitState,
} from "@src/shared/types";
import {
  createMockUnit,
  createMockGameState,
} from "@src/engine/tests/utils/MockFactory";

// Mock Image
class MockImage {
  onload: any = null;
  src: string = "";
  complete: boolean = true;
}
vi.stubGlobal("Image", MockImage);

describe("Layer Rendering Order", () => {
  let renderer: GameRenderer;
  let mockCanvas: HTMLCanvasElement;
  let mockContext: any;

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
    } as any;

    renderer = new GameRenderer(mockCanvas);
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
      loot: [
        { id: "l1", itemId: "medkit", pos: { x: 0, y: 0 } }
      ],
      visibleCells: ["0,0"],
      discoveredCells: ["0,0"],
    });

    renderer.render(gameState);

    const calls: { name: string; order: number; args: any[] }[] = [];
    Object.keys(mockContext).forEach(key => {
      const mock = (mockContext as any)[key];
      if (mock && mock.mock && mock.mock.invocationCallOrder) {
        mock.mock.calls.forEach((args: any[], i: number) => {
          calls.push({ name: key, order: mock.mock.invocationCallOrder[i], args });
        });
      }
    });
    calls.sort((a, b) => a.order - b.order);

    // We want to check the order of calls to the context.
    // UnitLayer uses arc() (for non-sprite units)
    // MapEntityLayer uses fillRect() (for spawn bg) and drawImage() (for spawn icon)

    const arcCall = calls.find(c => c.name === "arc");
    const arcIndex = arcCall ? arcCall.order : -1;

    const fillRectCalls = calls.filter(c => c.name === "fillRect");
    // The first few fillRects are for the floor in MapLayer.
    // The spawn point is drawn in MapEntityLayer, which is between MapLayer and UnitLayer.
    const spawnBgCall = fillRectCalls.find(c => c.args[0] === 0 && c.args[1] === 0 && c.args[2] === 32 && c.order > 5);
    const spawnBgIndex = spawnBgCall ? spawnBgCall.order : -1;

    const drawImageCalls = calls.filter(c => c.name === "drawImage");
    const spawnIconCall = drawImageCalls.find(c => c.order > 0);
    const spawnIconIndex = spawnIconCall ? spawnIconCall.order : -1;

    expect(arcIndex).toBeDefined();
    expect(spawnBgIndex).not.toBe(-1);
    expect(spawnIconIndex).not.toBe(-1);
    
    // Both background and icon should be drawn before the unit
    expect(arcIndex).toBeGreaterThan(spawnBgIndex);
    expect(arcIndex).toBeGreaterThan(spawnIconIndex);
  });
});
