import { RenderLayer } from "./RenderLayer";
import { SharedRendererState } from "./SharedRendererState";
import { GameState, UnitState } from "@src/shared/types";
import { ThemeManager } from "@src/renderer/ThemeManager";
import { AssetManager } from "./AssetManager";
import { VisibilityPolygon } from "@src/renderer/VisibilityPolygon";

export class OverlayLayer implements RenderLayer {
  private theme = ThemeManager.getInstance();
  private assets = AssetManager.getInstance();

  constructor(private sharedState: SharedRendererState) {}

  public draw(ctx: CanvasRenderingContext2D, state: GameState): void {
    if (state.settings.debugOverlayEnabled) {
      this.renderDebugOverlay(ctx, state);
    }
    if (state.settings.losOverlayEnabled) {
      this.renderLOSOverlay(ctx, state);
    }
    this.renderOverlay(ctx);
  }

  private renderDebugOverlay(ctx: CanvasRenderingContext2D, state: GameState) {
    const map = state.map;
    const cellSize = this.sharedState.cellSize;
    ctx.fillStyle = this.theme.getColor("--color-text-dim");
    ctx.font = "10px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        ctx.fillText(`${x},${y}`, x * cellSize + 2, y * cellSize + 2);
      }
    }

    map.doors?.forEach((door) => {
      if (door.segment.length !== 2) return;
      const [p1, p2] = door.segment;
      const cx = ((p1.x + p2.x) / 2) * cellSize + cellSize / 2;
      const cy = ((p1.y + p2.y) / 2) * cellSize + cellSize / 2;
      ctx.fillStyle = this.theme.getColor("--color-hive");
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(door.id, cx + 8, cy);
    });
  }

  private renderLOSOverlay(ctx: CanvasRenderingContext2D, state: GameState) {
    if (!this.sharedState.graph) return;
    const cellSize = this.sharedState.cellSize;

    if (state.settings.debugOverlayEnabled) {
      ctx.strokeStyle = this.theme.getColor("--color-los-soldier");
      ctx.lineWidth = 1;
      state.units.forEach((u) => {
        if (
          u.hp > 0 &&
          u.state !== UnitState.Extracted &&
          u.state !== UnitState.Dead
        ) {
          state.visibleCells.forEach((cellKey) => {
            const [cx, cy] = cellKey.split(",").map(Number);
            ctx.beginPath();
            ctx.moveTo(u.pos.x * cellSize, u.pos.y * cellSize);
            ctx.lineTo((cx + 0.5) * cellSize, (cy + 0.5) * cellSize);
            ctx.stroke();
          });
        }
      });
    }

    state.units.forEach((u) => {
      if (
        u.hp > 0 &&
        u.state !== UnitState.Extracted &&
        u.state !== UnitState.Dead
      ) {
        const polygon = VisibilityPolygon.compute(
          u.pos,
          this.sharedState.graph!,
        );
        if (polygon.length > 0) {
          const x = u.pos.x * cellSize;
          const y = u.pos.y * cellSize;
          const radius = (state.map.width + state.map.height) * cellSize;
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
          gradient.addColorStop(0, this.theme.getColor("--color-los-soldier"));
          gradient.addColorStop(
            1,
            this.theme.getColor("--color-los-soldier-fade"),
          );

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.moveTo(polygon[0].x * cellSize, polygon[0].y * cellSize);
          for (let i = 1; i < polygon.length; i++) {
            ctx.lineTo(polygon[i].x * cellSize, polygon[i].y * cellSize);
          }
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = this.theme.getColor("--color-los-soldier");
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    });

    state.enemies.forEach((e) => {
      if (e.hp > 0) {
        const cellKey = `${Math.floor(e.pos.x)},${Math.floor(e.pos.y)}`;
        if (!state.visibleCells.includes(cellKey)) return;

        const radius = (state.map.width + state.map.height) * cellSize;
        const polygon = VisibilityPolygon.compute(
          e.pos,
          this.sharedState.graph!,
        );
        if (polygon.length > 0) {
          const x = e.pos.x * cellSize;
          const y = e.pos.y * cellSize;
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
          gradient.addColorStop(0, this.theme.getColor("--color-los-enemy"));
          gradient.addColorStop(
            1,
            this.theme.getColor("--color-los-enemy-fade"),
          );

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.moveTo(polygon[0].x * cellSize, polygon[0].y * cellSize);
          for (let i = 1; i < polygon.length; i++) {
            ctx.lineTo(polygon[i].x * cellSize, polygon[i].y * cellSize);
          }
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = this.theme.getColor("--color-los-enemy");
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    });
  }

  private renderOverlay(ctx: CanvasRenderingContext2D) {
    if (this.sharedState.overlayOptions.length === 0) return;
    const cellSize = this.sharedState.cellSize;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    this.sharedState.overlayOptions.forEach((opt) => {
      if (opt.pos && opt.renderOnBoard !== false) {
        let drawX = opt.pos.x;
        let drawY = opt.pos.y;
        if (Number.isInteger(drawX)) drawX += 0.5;
        if (Number.isInteger(drawY)) drawY += 0.5;

        const cx = drawX * cellSize;
        const cy = drawY * cellSize;

        ctx.fillStyle = this.theme.getColor("--color-warning");
        ctx.beginPath();
        ctx.arc(cx, cy, 24, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = this.theme.getColor("--color-black");
        ctx.font = "bold 32px Arial";
        ctx.fillText(opt.key, cx, cy);

        if (opt.label) {
          ctx.fillStyle = this.theme.getColor("--color-text");
          ctx.font = "bold 18px Arial";
          ctx.shadowColor = this.theme.getColor("--color-black");
          ctx.shadowBlur = 4;
          ctx.fillText(opt.label, cx, cy + 45);
          ctx.shadowBlur = 0;
        }
      }
    });
  }
}
