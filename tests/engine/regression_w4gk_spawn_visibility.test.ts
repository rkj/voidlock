import { describe, it, expect, vi } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  SquadConfig,
  UnitStyle,
} from "@src/shared/types";
import { MapEntityLayer } from "@src/renderer/visuals/MapEntityLayer";
import { SharedRendererState } from "@src/renderer/visuals/SharedRendererState";

// Mock Image
class MockImage {
  onload: (() => void) | null = null;
  src: string = "";
  complete: boolean = true;
}
vi.stubGlobal("Image", MockImage);

describe("Regression voidlock-w4gk: Enemy Spawn Point Visibility", () => {
  it("should persistently include spawnPoints in engine state after multiple ticks", () => {
    const mockMap: MapDefinition = {
      width: 10,
      height: 10,
      cells: [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 1, y: 0, type: CellType.Floor },
      ],
      spawnPoints: [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }],
      squadSpawn: { x: 0, y: 0 },
      extraction: { x: 9, y: 9 },
    };
    const squadConfig: SquadConfig = {
      soldiers: [{ archetypeId: "assault" }],
      inventory: {},
    };
    const engine = new CoreEngine(mockMap, 123, squadConfig, false, false);

    // Initial state (tick 0)
    let state = engine.getState();
    expect(state.map.spawnPoints).toBeDefined();
    expect(state.map.spawnPoints!.length).toBe(1);
    expect(state.map.spawnPoints![0].id).toBe("sp1");
    expect(state.map.extraction).toBeDefined();
    expect(state.map.squadSpawns).toBeDefined();
    expect(state.map.cells.length).toBeGreaterThan(0); // First send includes cells

    // Advance one tick
    engine.update(100);
    state = engine.getState();
    expect(state.map.spawnPoints).toBeDefined();
    expect(state.map.spawnPoints!.length).toBe(1);
    expect(state.map.spawnPoints![0].id).toBe("sp1");
    expect(state.map.extraction).toBeDefined();
    expect(state.map.squadSpawns).toBeDefined();
    expect(state.map.cells.length).toBe(0); // Subsequent sends omit cells

    // Advance multiple ticks
    for (let i = 0; i < 10; i++) engine.update(100);
    state = engine.getState();
    expect(state.map.spawnPoints).toBeDefined();
    expect(state.map.spawnPoints!.length).toBe(1);
    expect(state.map.spawnPoints![0].id).toBe("sp1");
    expect(state.map.extraction).toBeDefined();
    expect(state.map.squadSpawns).toBeDefined();
  });

  it("should ALWAYS render spawnPoints even if the cell is NOT discovered and NOT visible (ADR 0032)", () => {
    const sharedState = new SharedRendererState();
    sharedState.cellSize = 32;
    sharedState.unitStyle = UnitStyle.Sprites;
    const layer = new MapEntityLayer(sharedState);

    const mockContext = {
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
    };

    const gameState = {
      map: {
        width: 10,
        height: 10,
        cells: [],
        spawnPoints: [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }],
      },
      units: [],
      enemies: [],
      loot: [],
      mines: [],
      turrets: [],
      visibleCells: [], // Nothing visible
      discoveredCells: [], // Nothing discovered
      settings: {
        debugOverlayEnabled: false,
      },
    } as any;

    layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

    const drewSomething =
      mockContext.drawImage.mock.calls.length > 0 ||
      mockContext.fillRect.mock.calls.some(
        (call) => call[0] === 5 * 32 && call[1] === 5 * 32,
      );

    expect(drewSomething).toBe(true);
  });

  it("should render spawnPoints if debug overlay is enabled even if NOT discovered", () => {
    const sharedState = new SharedRendererState();
    sharedState.cellSize = 32;
    sharedState.unitStyle = UnitStyle.Sprites;
    const layer = new MapEntityLayer(sharedState);

    const mockContext = {
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
    };

    const gameState = {
      map: {
        width: 10,
        height: 10,
        cells: [],
        spawnPoints: [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }],
      },
      units: [],
      enemies: [],
      loot: [],
      mines: [],
      turrets: [],
      visibleCells: [],
      discoveredCells: [],
      settings: {
        debugOverlayEnabled: true,
      },
    } as any;

    layer.draw(mockContext as unknown as CanvasRenderingContext2D, gameState);

    const drewSomething =
      mockContext.drawImage.mock.calls.length > 0 ||
      mockContext.fillRect.mock.calls.some(
        (call) => call[0] === 5 * 32 && call[1] === 5 * 32,
      );

    expect(drewSomething).toBe(true);
  });
});
