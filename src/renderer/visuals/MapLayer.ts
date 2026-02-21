import { RenderLayer } from "./RenderLayer";
import { SharedRendererState } from "./SharedRendererState";
import { GameState, CellType, BoundaryType, Door } from "@src/shared/types";
import { ThemeManager } from "@src/renderer/ThemeManager";
import { MathUtils } from "@src/shared/utils/MathUtils";

export class MapLayer implements RenderLayer {
  private theme = ThemeManager.getInstance();

  constructor(private sharedState: SharedRendererState) {}

  public draw(ctx: CanvasRenderingContext2D, state: GameState): void {
    this.renderMap(ctx, state);
    this.renderFog(ctx, state);
  }

  private isCellDiscovered(state: GameState, x: number, y: number): boolean {
    if (state.settings.debugOverlayEnabled) return true;
    if (state.gridState) {
      if (
        x < 0 ||
        y < 0 ||
        x >= state.map.width ||
        y >= state.map.height
      )
        return false;
      return (state.gridState[y * state.map.width + x] & 2) !== 0;
    }
    const key = `${x},${y}`;
    return state.discoveredCells.includes(key);
  }

  private renderMap(ctx: CanvasRenderingContext2D, state: GameState) {
    const map = state.map;
    const cellSize = this.sharedState.cellSize;
    const cells =
      this.sharedState.cells.length > 0 ? this.sharedState.cells : map.cells;

    // Floor
    cells.forEach((cell) => {
      if (cell.type === CellType.Floor) {
        if (!this.isCellDiscovered(state, cell.x, cell.y)) return;

        ctx.fillStyle = this.theme.getColor("--color-floor");
        ctx.fillRect(cell.x * cellSize, cell.y * cellSize, cellSize, cellSize);

        // Grid lines (faint)
        ctx.strokeStyle = this.theme.getColor("--color-grid");
        ctx.lineWidth = 1;
        ctx.strokeRect(
          cell.x * cellSize,
          cell.y * cellSize,
          cellSize,
          cellSize,
        );
      }
    });

    if (!this.sharedState.graph) return;

    // Draw Walls and Doors
    ctx.lineCap = "round";

    // Render Walls (Neon Cyan)
    ctx.strokeStyle = this.theme.getColor("--color-wall");
    ctx.lineWidth = 2;
    ctx.beginPath();

    this.sharedState.graph.getAllBoundaries().forEach((boundary) => {
      if (boundary.type === BoundaryType.Wall) {
        if (
          !this.isCellDiscovered(state, boundary.x1, boundary.y1) &&
          !this.isCellDiscovered(state, boundary.x2, boundary.y2)
        ) {
          return;
        }

        const seg = boundary.getVisualSegment();
        ctx.moveTo(seg.p1.x * cellSize, seg.p1.y * cellSize);
        ctx.lineTo(seg.p2.x * cellSize, seg.p2.y * cellSize);
      }
    });
    ctx.stroke();

    // Render Doors
    state.map.doors?.forEach((door) => {
      if (door.segment.length === 2) {
        if (
          !this.isCellDiscovered(state, door.segment[0].x, door.segment[0].y) &&
          !this.isCellDiscovered(state, door.segment[1].x, door.segment[1].y)
        ) {
          return;
        }
      }
      this.renderDoor(ctx, door);
    });
  }

  private renderDoor(ctx: CanvasRenderingContext2D, door: Door) {
    const cellSize = this.sharedState.cellSize;
    const doorThickness = cellSize / 8;
    const doorLength = cellSize / 3;

    if (door.segment.length !== 2) return;
    const [p1, p2] = door.segment;

    const s = cellSize;
    let startX: number, startY: number, endX: number, endY: number;
    let strut1_sx: number,
      strut1_sy: number,
      strut1_ex: number,
      strut1_ey: number;
    let strut2_sx: number,
      strut2_sy: number,
      strut2_ex: number,
      strut2_ey: number;

    if (door.orientation === "Vertical") {
      const cellX = Math.min(p1.x, p2.x);
      const cellY = p1.y;
      const wallX = (cellX + 1) * s;
      const wallY = cellY * s;

      startX = wallX;
      startY = wallY + (s - doorLength) / 2;
      endX = wallX;
      endY = startY + doorLength;

      strut1_sx = wallX;
      strut1_sy = wallY;
      strut1_ex = wallX;
      strut1_ey = startY;
      strut2_sx = wallX;
      strut2_sy = endY;
      strut2_ex = wallX;
      strut2_ey = wallY + s;
    } else {
      const cellX = p1.x;
      const cellY = Math.min(p1.y, p2.y);
      const wallX = cellX * s;
      const wallY = (cellY + 1) * s;

      startX = wallX + (s - doorLength) / 2;
      startY = wallY;
      endX = startX + doorLength;
      endY = wallY;

      strut1_sx = wallX;
      strut1_sy = wallY;
      strut1_ex = startX;
      strut1_ey = wallY;
      strut2_sx = endX;
      strut2_sy = wallY;
      strut2_ex = wallX + s;
      strut2_ey = wallY;
    }

    ctx.lineWidth = doorThickness;

    let openRatio = 0;
    if (door.state === "Open" && !door.targetState) openRatio = 1;
    else if (
      door.state === "Closed" &&
      door.targetState === "Open" &&
      door.openTimer &&
      door.openDuration
    ) {
      openRatio = 1 - door.openTimer / (door.openDuration * 1000);
    } else if (
      door.state === "Open" &&
      door.targetState === "Closed" &&
      door.openTimer &&
      door.openDuration
    ) {
      openRatio = door.openTimer / (door.openDuration * 1000);
    }

    const slideOffset = openRatio * (doorLength / 2);

    if (door.state === "Locked" || door.targetState === "Locked") {
      ctx.strokeStyle = this.theme.getColor("--color-door-locked");
    } else if (door.state === "Destroyed") {
      ctx.strokeStyle = this.theme.getColor("--color-door-destroyed");
    } else {
      ctx.strokeStyle = this.theme.getColor("--color-door-closed");
      if (openRatio > 0.8)
        ctx.strokeStyle = this.theme.getColor("--color-door-dim");
    }

    if (door.state !== "Destroyed") {
      const cx = (startX + endX) / 2;
      const cy = (startY + endY) / 2;
      const dx = endX - startX;
      const dy = endY - startY;
      const len = MathUtils.getDistance(
        { x: startX, y: startY },
        { x: endX, y: endY },
      );
      const ux = dx / len;
      const uy = dy / len;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(cx - ux * slideOffset, cy - uy * slideOffset);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(cx + ux * slideOffset, cy + uy * slideOffset);
      ctx.stroke();

      ctx.lineWidth = 2;
      ctx.strokeStyle = this.theme.getColor("--color-wall");
      ctx.beginPath();
      ctx.moveTo(strut1_sx, strut1_sy);
      ctx.lineTo(strut1_ex, strut1_ey);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(strut2_sx, strut2_sy);
      ctx.lineTo(strut2_ex, strut2_ey);
      ctx.stroke();
    }
  }

  private renderFog(ctx: CanvasRenderingContext2D, state: GameState) {
    if (state.settings.debugOverlayEnabled) return;

    const map = state.map;
    const cellSize = this.sharedState.cellSize;

    if (state.gridState) {
      const width = map.width;
      const height = map.height;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const val = state.gridState[y * width + x];
          const isVisible = val & 1;
          const isDiscovered = val & 2;

          if (isVisible) continue;

          if (isDiscovered) {
            ctx.fillStyle = this.theme.getColor("--color-fog-discovered");
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          } else {
            ctx.fillStyle = this.theme.getColor("--color-fog-unexplored");
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          }
        }
      }
    } else {
      // Fallback for old states
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const key = `${x},${y}`;
          const isVisible = state.visibleCells.includes(key);
          const isDiscovered = state.discoveredCells.includes(key);

          if (isVisible) continue;

          if (isDiscovered) {
            ctx.fillStyle = this.theme.getColor("--color-fog-discovered");
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          } else {
            ctx.fillStyle = this.theme.getColor("--color-fog-unexplored");
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          }
        }
      }
    }
  }
}
