import { RenderLayer } from "./RenderLayer";
import { SharedRendererState } from "./SharedRendererState";
import { GameState, AttackEvent } from "@src/shared/types";
import { ThemeManager } from "@src/renderer/ThemeManager";

export class EffectLayer implements RenderLayer {
  private theme = ThemeManager.getInstance();
  private activeEvents: AttackEvent[] = [];
  private TRACER_DURATION = 150;

  constructor(private sharedState: SharedRendererState) {}

  public draw(ctx: CanvasRenderingContext2D, state: GameState): void {
    const cellSize = this.sharedState.cellSize;

    // 1. Process new events from state
    if (state.attackEvents && state.attackEvents.length > 0) {
      state.attackEvents.forEach((ev) => {
        // Only add if not already in our local list (based on attacker + time)
        const exists = this.activeEvents.some(
          (ae) => ae.attackerId === ev.attackerId && ae.time === ev.time,
        );
        if (!exists) {
          this.activeEvents.push(ev);
        }
      });
    }

    // 2. Filter out old events
    this.activeEvents = this.activeEvents.filter(
      (ev) => state.t - ev.time < this.TRACER_DURATION,
    );

    // 3. Draw tracers
    this.activeEvents.forEach((ev) => {
      const attackerCellKey = `${Math.floor(ev.attackerPos.x)},${Math.floor(
        ev.attackerPos.y,
      )}`;
      const targetCellKey = `${Math.floor(ev.targetPos.x)},${Math.floor(
        ev.targetPos.y,
      )}`;

      const attackerVisible = state.visibleCells.includes(attackerCellKey);
      const targetVisible = state.visibleCells.includes(targetCellKey);

      // We show tracers if either end is in a visible cell.
      // This ensures we see shots coming from the fog if they hit a visible unit.
      if (attackerVisible || targetVisible) {
        ctx.beginPath();
        ctx.moveTo(ev.attackerPos.x * cellSize, ev.attackerPos.y * cellSize);
        ctx.lineTo(ev.targetPos.x * cellSize, ev.targetPos.y * cellSize);
        ctx.strokeStyle = this.theme.getColor("--color-warning");
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    });
  }
}
