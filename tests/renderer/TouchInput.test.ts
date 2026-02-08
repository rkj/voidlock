/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { InputManager } from "@src/renderer/InputManager";
import { InputDispatcher } from "@src/renderer/InputDispatcher";
import { InputPriority } from "@src/shared/types";

describe("InputManager Touch Gestures", () => {
  let inputManager: InputManager;
  let panMapBy: any;
  let zoomMap: any;
  let handleCanvasClick: any;

  beforeEach(() => {
    panMapBy = vi.fn();
    zoomMap = vi.fn();
    handleCanvasClick = vi.fn();

    inputManager = new InputManager(
      { getCurrentScreen: () => "mission" } as any,
      { isShiftHeld: false, menuState: "ACTION_SELECT" } as any,
      {} as any,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      handleCanvasClick,
      vi.fn(),
      vi.fn(),
      () => null,
      () => false,
      vi.fn(),
      () => ({ x: 0, y: 0 }),
      vi.fn(),
      vi.fn(),
      panMapBy,
      zoomMap,
    );

    // Mock document.getElementById for game-canvas
    const mockCanvas = document.createElement("div");
    mockCanvas.id = "game-canvas";
    document.body.appendChild(mockCanvas);
  });

  it("should handle 1-finger pan", () => {
    const mockTouchStart = {
      target: document.getElementById("game-canvas"),
      touches: [{ clientX: 100, clientY: 100 }],
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as any;

    inputManager.handleTouchStart(mockTouchStart);

    const mockTouchMove = {
      target: document.getElementById("game-canvas"),
      touches: [{ clientX: 110, clientY: 120 }],
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as any;

    inputManager.handleTouchMove(mockTouchMove);

    expect(panMapBy).toHaveBeenCalledWith(-10, -20);
  });

  it("should handle 2-finger pinch zoom", () => {
    const mockTouchStart = {
      target: document.getElementById("game-canvas"),
      touches: [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 200 },
      ],
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as any;

    inputManager.handleTouchStart(mockTouchStart);

    const mockTouchMove = {
      target: document.getElementById("game-canvas"),
      touches: [
        { clientX: 50, clientY: 50 },
        { clientX: 250, clientY: 250 },
      ],
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as any;

    inputManager.handleTouchMove(mockTouchMove);

    // Initial distance: sqrt(100^2 + 100^2) = 141.42
    // New distance: sqrt(200^2 + 200^2) = 282.84
    // Ratio: 2.0
    expect(zoomMap).toHaveBeenCalled();
    const ratio = zoomMap.mock.calls[0][0];
    expect(ratio).toBeCloseTo(2.0);
  });

  it("should handle single tap as click", () => {
    vi.useFakeTimers();
    const mockTouchStart = {
      target: document.getElementById("game-canvas"),
      touches: [{ clientX: 100, clientY: 100 }],
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as any;

    inputManager.handleTouchStart(mockTouchStart);

    vi.advanceTimersByTime(100);

    const mockTouchEnd = {
      target: document.getElementById("game-canvas"),
      touches: [],
      changedTouches: [{ clientX: 100, clientY: 100 }],
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as any;

    inputManager.handleTouchEnd(mockTouchEnd);

    expect(handleCanvasClick).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
