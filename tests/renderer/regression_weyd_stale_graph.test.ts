/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Renderer } from "../../src/renderer/Renderer";
import {
  GameState,
  CellType,
  BoundaryType,
  EngineMode,
  MissionType,
} from "../../src/shared/types";

describe("Renderer Stale Graph Regression (voidlock-weyd)", () => {
  let canvas: HTMLCanvasElement;
  let renderer: Renderer;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    // Mock getContext
    canvas.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      fillText: vi.fn(),
      drawImage: vi.fn(),
      createRadialGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
    } as any);
    renderer = new Renderer(canvas);
  });

  it("should recreate the graph when the seed changes even if map size and cell count are the same", () => {
    // Mission 1: Has a door at (1,0)-(2,0)
    const state1: GameState = {
      t: 0,
      seed: 123,
      missionType: MissionType.Default,
      map: {
        width: 3,
        height: 1,
        cells: [
          { x: 0, y: 0, type: CellType.Floor },
          { x: 1, y: 0, type: CellType.Floor },
          { x: 2, y: 0, type: CellType.Floor },
        ],
        doors: [
          {
            id: "door-1",
            segment: [
              { x: 1, y: 0 },
              { x: 2, y: 0 },
            ],
            orientation: "Vertical",
            state: "Open", // Important: Passable
            hp: 50,
            maxHp: 50,
            openDuration: 1,
          },
        ],
        walls: [],
      },
      units: [],
      enemies: [],
      visibleCells: ["1,0", "2,0"],
      discoveredCells: ["1,0", "2,0"],
      objectives: [],
      stats: {
        threatLevel: 0,
        aliensKilled: 0,
        elitesKilled: 0,
        scrapGained: 0,
        casualties: 0,
      },
      status: "Playing",
      settings: {
        mode: EngineMode.Simulation,
        debugOverlayEnabled: false,
        losOverlayEnabled: false,
        timeScale: 1.0,
        isPaused: false,
        isSlowMotion: false,
        allowTacticalPause: true,
      },
      squadInventory: {},
      loot: [],
      mines: [],
      turrets: [],
    };

    renderer.render(state1);

    // Check internal graph state via private access (casting to any)
    let graph = (renderer as any).graph;
    let boundary = graph.getBoundary(1, 0, 2, 0);
    expect(boundary.type).toBe(BoundaryType.Open); // Set by syncDoorsToGraph because door is Open

    // Mission 2: Same size, same cell count, DIFFERENT seed.
    // Has a WALL at (1,0)-(2,0) and NO door.
    const state2: GameState = {
      ...state1,
      seed: 456, // Different seed
      map: {
        ...state1.map,
        doors: [],
        walls: [{ p1: { x: 2, y: 0 }, p2: { x: 2, y: 1 } }], // Vertical wall between (1,0) and (2,0)
      },
    };

    renderer.render(state2);

    graph = (renderer as any).graph;
    boundary = graph.getBoundary(1, 0, 2, 0);

    // IF THE BUG EXISTS, this will fail because the graph was reused and the boundary is still 'Open'
    expect(boundary.type).toBe(BoundaryType.Wall);
  });
});
