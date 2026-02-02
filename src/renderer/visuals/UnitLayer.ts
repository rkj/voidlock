import { RenderLayer } from "./RenderLayer";
import { SharedRendererState } from "./SharedRendererState";
import {
  GameState,
  UnitState,
  UnitStyle,
  Vector2,
  Unit,
} from "@src/shared/types";
import { ThemeManager } from "@src/renderer/ThemeManager";
import { AssetManager } from "./AssetManager";
import { isCellVisible } from "@src/shared/VisibilityUtils";

export class UnitLayer implements RenderLayer {
  private theme = ThemeManager.getInstance();
  private assets = AssetManager.getInstance();

  constructor(private sharedState: SharedRendererState) {}

  public draw(ctx: CanvasRenderingContext2D, state: GameState): void {
    this.renderUnits(ctx, state);
    this.renderEnemies(ctx, state);
  }

  private renderUnits(ctx: CanvasRenderingContext2D, state: GameState) {
    const cellSize = this.sharedState.cellSize;

    state.units.forEach((unit, index) => {
      if (unit.state === UnitState.Extracted || unit.state === UnitState.Dead)
        return;

      const x = unit.pos.x * cellSize;
      const y = unit.pos.y * cellSize;

      const sprite = this.assets.getUnitSprite(unit.archetypeId);

      if (
        this.sharedState.unitStyle === UnitStyle.Sprites &&
        sprite &&
        sprite.complete &&
        sprite.naturalWidth > 0
      ) {
        const spriteSize = cellSize * 0.24;
        ctx.drawImage(
          sprite,
          x - spriteSize / 2,
          y - spriteSize / 2,
          spriteSize,
          spriteSize,
        );

        ctx.font = `bold ${Math.floor(cellSize / 6)}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeStyle = this.theme.getColor("--color-black");
        ctx.lineWidth = 4;
        ctx.strokeText((index + 1).toString(), x, y);
        ctx.fillStyle = this.theme.getColor("--color-white");
        ctx.fillText((index + 1).toString(), x, y);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, cellSize / 6, 0, Math.PI * 2);

        if (unit.state === UnitState.Channeling)
          ctx.fillStyle = this.theme.getColor("--color-info");
        else if (unit.state === UnitState.Attacking)
          ctx.fillStyle = this.theme.getColor("--color-danger");
        else if (unit.state === UnitState.Moving)
          ctx.fillStyle = this.theme.getColor("--color-door-closed");
        else ctx.fillStyle = this.theme.getColor("--color-primary");

        ctx.fill();
        ctx.strokeStyle = this.theme.getColor("--color-black");
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = this.theme.getColor("--color-black");
        ctx.font = `bold ${Math.floor(cellSize / 8)}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((index + 1).toString(), x, y);
      }

      if (unit.carriedObjectiveId) {
        ctx.fillStyle = this.theme.getColor("--color-danger");
        ctx.font = `bold ${Math.floor(cellSize / 10)}px monospace`;
        ctx.fillText("BURDENED", x, y - cellSize / 4);
      }

      this.renderHealthBar(ctx, x, y, unit.hp, unit.maxHp);

      if (unit.state === UnitState.Channeling && unit.channeling) {
        this.renderChannelingBar(
          ctx,
          x,
          y,
          unit.channeling.remaining,
          unit.channeling.totalDuration,
        );
      }

      if (unit.state === UnitState.Moving && unit.targetPos) {
        this.renderMovementPath(ctx, x, y, unit);
      }
    });
  }

  private renderEnemies(ctx: CanvasRenderingContext2D, state: GameState) {
    const cellSize = this.sharedState.cellSize;

    state.enemies.forEach((enemy, index) => {
      if (enemy.hp <= 0) return;

      const ex = Math.floor(enemy.pos.x);
      const ey = Math.floor(enemy.pos.y);
      if (!isCellVisible(state, ex, ey)) return;

      const x = enemy.pos.x * cellSize;
      const y = enemy.pos.y * cellSize;
      const size = cellSize / 6;

      const sprite = this.assets.getEnemySprite(enemy.type);
      const idMatch = enemy.id.match(/\d+/);
      const idNum = idMatch ? parseInt(idMatch[0]) : index;
      const indicator = String.fromCharCode(65 + (idNum % 26));

      if (
        this.sharedState.unitStyle === UnitStyle.Sprites &&
        sprite &&
        sprite.complete &&
        sprite.naturalWidth > 0
      ) {
        const spriteSize = cellSize * 0.24;
        ctx.drawImage(
          sprite,
          x - spriteSize / 2,
          y - spriteSize / 2,
          spriteSize,
          spriteSize,
        );

        ctx.font = `bold ${Math.floor(cellSize / 10)}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeStyle = this.theme.getColor("--color-black");
        ctx.lineWidth = 3;
        ctx.strokeText(indicator, x, y);
        ctx.fillStyle = this.theme.getColor("--color-white");
        ctx.fillText(indicator, x, y);
      } else {
        ctx.beginPath();
        if (enemy.type === "hive") {
          const icon = this.assets.iconImages.Hive;
          if (icon && this.sharedState.unitStyle === UnitStyle.Sprites) {
            const hiveSize = cellSize * 0.24;
            ctx.drawImage(
              icon,
              x - hiveSize / 2,
              y - hiveSize / 2,
              hiveSize,
              hiveSize,
            );
          } else {
            ctx.fillStyle = this.theme.getColor("--color-hive");
            const hiveSize = cellSize * 0.6;
            ctx.rect(x - hiveSize / 2, y - hiveSize / 2, hiveSize, hiveSize);
            ctx.fill();
            ctx.strokeStyle = this.theme.getColor("--color-black");
            ctx.lineWidth = 3;
            ctx.stroke();
          }
          // Render indicator for Hive too
          ctx.fillStyle = this.theme.getColor("--color-text");
          ctx.font = `bold ${Math.floor(cellSize / 10)}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(indicator, x, y);
        } else {
          this.drawEnemyShape(ctx, x, y, size, enemy.type);
          ctx.fillStyle = this.theme.getColor("--color-danger");
          ctx.fill();
          ctx.strokeStyle = this.theme.getColor("--color-black");
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.fillStyle = this.theme.getColor("--color-text");
          ctx.font = `bold ${Math.floor(cellSize / 10)}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(indicator, x, y);
        }
      }

      this.renderHealthBar(ctx, x, y, enemy.hp, enemy.maxHp);
    });
  }

  private drawEnemyShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    type: string,
  ) {
    if (type === "xeno-mite") {
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size, y + size);
      ctx.lineTo(x - size, y + size);
    } else if (type === "warrior-drone") {
      ctx.moveTo(x, y - size * 1.2);
      ctx.lineTo(x + size * 1.2, y);
      ctx.lineTo(x, y + size * 1.2);
      ctx.lineTo(x - size * 1.2, y);
    } else if (type === "spitter-acid") {
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        const px = x + Math.cos(angle) * size * 1.1;
        const py = y + Math.sin(angle) * size * 1.1;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
    } else if (type === "praetorian-guard") {
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const px = x + Math.cos(angle) * size * 1.5;
        const py = y + Math.sin(angle) * size * 1.5;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
    } else {
      ctx.arc(x, y, size, 0, Math.PI * 2);
    }
    ctx.closePath();
  }

  private renderHealthBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    hp: number,
    maxHp: number,
  ) {
    const cellSize = this.sharedState.cellSize;
    const barWidth = cellSize * 0.5;
    const barHeight = 6;
    const yOffset = -cellSize / 6 - 12;

    ctx.fillStyle = this.theme.getColor("--color-black");
    ctx.fillRect(x - barWidth / 2, y + yOffset, barWidth, barHeight);

    const pct = Math.max(0, hp / maxHp);
    ctx.fillStyle =
      pct > 0.5
        ? this.theme.getColor("--color-success")
        : pct > 0.25
          ? this.theme.getColor("--color-warning")
          : this.theme.getColor("--color-danger");
    ctx.fillRect(x - barWidth / 2, y + yOffset, barWidth * pct, barHeight);
  }

  private renderChannelingBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    remaining: number,
    total: number,
  ) {
    const cellSize = this.sharedState.cellSize;
    const barWidth = cellSize * 0.6;
    const barHeight = 6;
    const yOffset = -cellSize / 6 - 22;

    ctx.fillStyle = this.theme.getColor("--color-black");
    ctx.fillRect(x - barWidth / 2, y + yOffset, barWidth, barHeight);

    const pct = Math.max(0, 1 - remaining / total);
    ctx.fillStyle = this.theme.getColor("--color-info");
    ctx.fillRect(x - barWidth / 2, y + yOffset, barWidth * pct, barHeight);

    ctx.strokeStyle = this.theme.getColor("--color-white");
    ctx.lineWidth = 1;
    ctx.strokeRect(x - barWidth / 2, y + yOffset, barWidth, barHeight);
  }

  private renderMovementPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    unit: Unit,
  ) {
    if (!unit.targetPos) return;
    const cellSize = this.sharedState.cellSize;
    const jitter = unit.visualJitter || { x: 0, y: 0 };
    const pathPoints: Vector2[] = [unit.targetPos];

    if (unit.path && unit.path.length > 1) {
      for (let i = 1; i < unit.path.length; i++) {
        pathPoints.push({
          x: unit.path[i].x + 0.5 + jitter.x,
          y: unit.path[i].y + 0.5 + jitter.y,
        });
      }
    }

    ctx.strokeStyle = this.theme.getColor("--color-hive");
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);

    let currX = x;
    let currY = y;

    pathPoints.forEach((p, idx) => {
      const nextX = p.x * cellSize;
      const nextY = p.y * cellSize;
      const alpha = Math.max(0.1, 1.0 - idx / Math.max(pathPoints.length, 5));
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(currX, currY);
      ctx.lineTo(nextX, nextY);
      ctx.stroke();
      currX = nextX;
      currY = nextY;
    });

    ctx.globalAlpha = 1.0;
    ctx.setLineDash([]);
  }
}
