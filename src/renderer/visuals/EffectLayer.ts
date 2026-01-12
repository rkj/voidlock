import { RenderLayer } from "./RenderLayer";
import { SharedRendererState } from "./SharedRendererState";
import { GameState, UnitState } from "@src/shared/types";
import { ThemeManager } from "@src/renderer/ThemeManager";

export class EffectLayer implements RenderLayer {
  private theme = ThemeManager.getInstance();

  constructor(private sharedState: SharedRendererState) {}

  public draw(ctx: CanvasRenderingContext2D, state: GameState): void {
    const cellSize = this.sharedState.cellSize;

    // Unit Tracers
    state.units.forEach((unit) => {
      if (unit.state === UnitState.Extracted || unit.state === UnitState.Dead) return;

      if (unit.lastAttackTarget && unit.lastAttackTime && state.t - unit.lastAttackTime < 150) {
        ctx.beginPath();
        ctx.moveTo(unit.pos.x * cellSize, unit.pos.y * cellSize);
        ctx.lineTo(
          unit.lastAttackTarget.x * cellSize,
          unit.lastAttackTarget.y * cellSize,
        );
        ctx.strokeStyle = this.theme.getColor("--color-warning");
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    });

    // Enemy Tracers
    state.enemies.forEach((enemy) => {
      if (enemy.hp <= 0) return;
      const cellKey = `${Math.floor(enemy.pos.x)},${Math.floor(enemy.pos.y)}`;
      if (!state.visibleCells.includes(cellKey)) return;

      if (enemy.lastAttackTarget && enemy.lastAttackTime && state.t - enemy.lastAttackTime < 150) {
        ctx.beginPath();
        ctx.moveTo(enemy.pos.x * cellSize, enemy.pos.y * cellSize);
        ctx.lineTo(
          enemy.lastAttackTarget.x * cellSize,
          enemy.lastAttackTarget.y * cellSize,
        );
        ctx.strokeStyle = this.theme.getColor("--color-warning");
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    });
  }
}
