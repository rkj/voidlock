import { RenderLayer } from "./RenderLayer";
import { SharedRendererState } from "./SharedRendererState";
import { GameState } from "@src/shared/types";
import { ThemeManager } from "@src/renderer/ThemeManager";
import { AssetManager } from "./AssetManager";

export class MapEntityLayer implements RenderLayer {
  private theme = ThemeManager.getInstance();
  private assets = AssetManager.getInstance();

  constructor(private sharedState: SharedRendererState) {}

  public draw(ctx: CanvasRenderingContext2D, state: GameState): void {
    this.renderExtraction(ctx, state);
    this.renderSpawnPoints(ctx, state);
    this.renderLoot(ctx, state);
    this.renderObjectives(ctx, state);
    this.renderMines(ctx, state);
  }

  private renderMines(ctx: CanvasRenderingContext2D, state: GameState) {
    const cellSize = this.sharedState.cellSize;

    state.mines?.forEach((mine) => {
      const x = mine.pos.x * cellSize;
      const y = mine.pos.y * cellSize;
      const key = `${Math.floor(mine.pos.x)},${Math.floor(mine.pos.y)}`;
      const isVisible = state.visibleCells.includes(key);

      if (!isVisible && !state.settings.debugOverlayEnabled) return;

      ctx.fillStyle = this.theme.getColor("--color-danger");
      ctx.beginPath();
      ctx.arc(x + cellSize / 2, y + cellSize / 2, cellSize * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = this.theme.getColor("--color-black");
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw a small 'M' or just a dot
      ctx.fillStyle = this.theme.getColor("--color-white");
      ctx.font = `bold ${Math.floor(cellSize / 5)}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("M", x + cellSize / 2, y + cellSize / 2);
    });
  }

  private renderExtraction(ctx: CanvasRenderingContext2D, state: GameState) {
    if (!state.map.extraction) return;

    const cellSize = this.sharedState.cellSize;
    const ext = state.map.extraction;
    const x = ext.x * cellSize;
    const y = ext.y * cellSize;

    const key = `${Math.floor(ext.x)},${Math.floor(ext.y)}`;
    const isKnown = state.discoveredCells.includes(key) || state.visibleCells.includes(key);

    if (!isKnown && !state.settings.debugOverlayEnabled) return;

    ctx.fillStyle = this.theme.getColor("--color-extraction-bg");
    ctx.fillRect(x, y, cellSize, cellSize);
    ctx.strokeStyle = this.theme.getColor("--color-info");
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);
    ctx.strokeRect(x + 5, y + 5, cellSize - 10, cellSize - 10);
    ctx.setLineDash([]);

    const icon = this.assets.iconImages.Exit;
    if (icon) {
      const iconSize = cellSize * 0.6;
      ctx.drawImage(icon, x + (cellSize - iconSize) / 2, y + (cellSize - iconSize) / 2, iconSize, iconSize);
    }
  }

  private renderSpawnPoints(ctx: CanvasRenderingContext2D, state: GameState) {
    const cellSize = this.sharedState.cellSize;

    state.map.spawnPoints?.forEach((sp) => {
      const x = sp.pos.x * cellSize;
      const y = sp.pos.y * cellSize;
      const key = `${Math.floor(sp.pos.x)},${Math.floor(sp.pos.y)}`;
      const isKnown = state.discoveredCells.includes(key) || state.visibleCells.includes(key);

      if (!isKnown && !state.settings.debugOverlayEnabled) return;

      ctx.fillStyle = this.theme.getColor("--color-spawn-bg");
      ctx.fillRect(x, y, cellSize, cellSize);

      const icon = this.assets.iconImages.Spawn;
      if (icon) {
        const iconSize = cellSize * 0.5;
        ctx.drawImage(icon, x + (cellSize - iconSize) / 2, y + (cellSize - iconSize) / 2, iconSize, iconSize);
      }
    });
  }

  private renderLoot(ctx: CanvasRenderingContext2D, state: GameState) {
    const cellSize = this.sharedState.cellSize;

    state.loot?.forEach((loot) => {
      const x = loot.pos.x * cellSize;
      const y = loot.pos.y * cellSize;
      const key = `${Math.floor(loot.pos.x)},${Math.floor(loot.pos.y)}`;
      const isVisible = state.visibleCells.includes(key);
      const isDiscovered = state.discoveredCells.includes(key);

      if (!isVisible && !isDiscovered && !state.settings.debugOverlayEnabled) return;

      // Render loot crate
      const icon = this.assets.iconImages.Crate;
      if (icon) {
        const iconSize = cellSize * 0.5;
        ctx.drawImage(icon, x + (cellSize - iconSize) / 2, y + (cellSize - iconSize) / 2, iconSize, iconSize);
      } else {
        ctx.fillStyle = this.theme.getColor("--color-objective-bg");
        ctx.fillRect(x + cellSize * 0.2, y + cellSize * 0.2, cellSize * 0.6, cellSize * 0.6);
      }
    });
  }

  private renderObjectives(ctx: CanvasRenderingContext2D, state: GameState) {
    const cellSize = this.sharedState.cellSize;

    state.objectives?.forEach((obj) => {
      if (obj.state === "Pending" && obj.targetCell && (obj.visible || state.settings.debugOverlayEnabled)) {
        if (state.map.extraction && obj.targetCell.x === state.map.extraction.x && obj.targetCell.y === state.map.extraction.y) return;

        const x = obj.targetCell.x * cellSize;
        const y = obj.targetCell.y * cellSize;
        ctx.fillStyle = this.theme.getColor("--color-objective-bg");
        ctx.fillRect(x + 4, y + 4, cellSize - 8, cellSize - 8);

        const icon = this.assets.iconImages.Objective;
        if (icon) {
          const iconSize = cellSize * 0.6;
          ctx.drawImage(icon, x + (cellSize - iconSize) / 2, y + (cellSize - iconSize) / 2, iconSize, iconSize);
        }
      }
    });
  }
}
