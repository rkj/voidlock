import { GameState, UnitStyle, OverlayOption, BoundaryType, Vector2 } from "@src/shared/types";
import { RenderLayer } from "./RenderLayer";
import { SharedRendererState } from "./SharedRendererState";
import { MapLayer } from "./MapLayer";
import { MapEntityLayer } from "./MapEntityLayer";
import { UnitLayer } from "./UnitLayer";
import { EffectLayer } from "./EffectLayer";
import { OverlayLayer } from "./OverlayLayer";
import { Graph } from "@src/engine/Graph";

export class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private sharedState: SharedRendererState = new SharedRendererState();
  private layers: RenderLayer[] = [];
  private lastTime: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.lastTime = performance.now();

    // Default layer stack
    this.layers = [
      new MapLayer(this.sharedState),
      new MapEntityLayer(this.sharedState),
      new UnitLayer(this.sharedState),
      new EffectLayer(this.sharedState),
      new OverlayLayer(this.sharedState),
    ];
  }

  public setCellSize(size: number) {
    this.sharedState.cellSize = size;
  }

  public setUnitStyle(style: UnitStyle) {
    this.sharedState.unitStyle = style;
  }

  public setOverlay(options: OverlayOption[]) {
    this.sharedState.overlayOptions = options;
  }

  private syncDoorsToGraph(state: GameState) {
    if (!this.sharedState.graph || !state.map.doors) return;

    state.map.doors.forEach((door) => {
      if (door.segment.length === 2) {
        const boundary = this.sharedState.graph?.getBoundary(
          door.segment[0].x,
          door.segment[0].y,
          door.segment[1].x,
          door.segment[1].y,
        );
        if (boundary) {
          const isPassable =
            door.state === "Open" ||
            door.state === "Destroyed" ||
            door.targetState === "Open";
          boundary.type = isPassable ? BoundaryType.Open : BoundaryType.Door;
        }
      }
    });
  }

  public get graph(): Graph | null {
    return this.sharedState.graph;
  }

  public render(state: GameState) {
    const now = performance.now();
    const deltaTime = now - this.lastTime;
    this.lastTime = now;

    // Update Graph if map changed
    const mapId = `${state.seed}-${state.map.width}x${state.map.height}-${state.map.cells.length}`;
    if (this.sharedState.currentMapId !== mapId) {
      this.sharedState.graph = new Graph(state.map);
      this.sharedState.currentMapId = mapId;
    }

    this.syncDoorsToGraph(state);

    const width = state.map.width * this.sharedState.cellSize;
    const height = state.map.height * this.sharedState.cellSize;

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (const layer of this.layers) {
      layer.draw(this.ctx, state, deltaTime);
    }
  }

  public getCellCoordinates(pixelX: number, pixelY: number): Vector2 {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const x = Math.floor(((pixelX - rect.left) * scaleX) / this.sharedState.cellSize);
    const y = Math.floor(((pixelY - rect.top) * scaleY) / this.sharedState.cellSize);
    return { x, y };
  }
}
