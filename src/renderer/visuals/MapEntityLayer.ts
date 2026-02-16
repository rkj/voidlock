import { RenderLayer } from "./RenderLayer";
import { SharedRendererState } from "./SharedRendererState";
import { GameState } from "@src/shared/types";
import { isCellVisible, isCellDiscovered } from "@src/shared/VisibilityUtils";
import { MathUtils } from "@src/shared/utils/MathUtils";
import { ThemeManager } from "@src/renderer/ThemeManager";
import { AssetManager } from "./AssetManager";

export class MapEntityLayer implements RenderLayer {
  private theme = ThemeManager.getInstance();
  private assets = AssetManager.getInstance();

  constructor(private sharedState: SharedRendererState) {}

  public draw(ctx: CanvasRenderingContext2D, state: GameState): void {
    this.renderExtraction(ctx, state);
    this.renderSpawnPoints(ctx, state);
    this.renderSquadSpawns(ctx, state);
    this.renderLoot(ctx, state);
    this.renderObjectives(ctx, state);
    this.renderMines(ctx, state);
    this.renderTurrets(ctx, state);
  }

  private renderSquadSpawns(ctx: CanvasRenderingContext2D, state: GameState) {
    if (state.status !== "Deployment") return;

    const cellSize = this.sharedState.cellSize;
    const spawns =
      state.map.squadSpawns ||
      (state.map.squadSpawn ? [state.map.squadSpawn] : []);

    spawns.forEach((sp) => {
      const x = sp.x * cellSize;
      const y = sp.y * cellSize;

      ctx.fillStyle = "rgba(0, 255, 0, 0.3)";
      ctx.fillRect(x, y, cellSize, cellSize);
      ctx.strokeStyle = "rgba(0, 255, 0, 0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
    });
  }

  private renderTurrets(ctx: CanvasRenderingContext2D, state: GameState) {
    const cellSize = this.sharedState.cellSize;

    state.turrets?.forEach((turret) => {
      const x = turret.pos.x * cellSize;
      const y = turret.pos.y * cellSize;
      const cell = MathUtils.toCellCoord(turret.pos);
      const isVisible = isCellVisible(state, cell.x, cell.y);

      if (!isVisible && !state.settings.debugOverlayEnabled) return;

      ctx.fillStyle = this.theme.getColor("--color-info");
      ctx.beginPath();
      ctx.arc(
        x + cellSize / 2,
        y + cellSize / 2,
        cellSize * 0.3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.strokeStyle = this.theme.getColor("--color-black");
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw a small 'T'
      ctx.fillStyle = this.theme.getColor("--color-white");
      ctx.font = `bold ${Math.floor(cellSize / 3)}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("T", x + cellSize / 2, y + cellSize / 2);
    });
  }

  private renderMines(ctx: CanvasRenderingContext2D, state: GameState) {
    const cellSize = this.sharedState.cellSize;

    state.mines?.forEach((mine) => {
      const x = mine.pos.x * cellSize;
      const y = mine.pos.y * cellSize;
      const cell = MathUtils.toCellCoord(mine.pos);
      const isVisible = isCellVisible(state, cell.x, cell.y);

      if (!isVisible && !state.settings.debugOverlayEnabled) return;

      ctx.fillStyle = this.theme.getColor("--color-danger");
      ctx.beginPath();
      ctx.arc(
        x + cellSize / 2,
        y + cellSize / 2,
        cellSize * 0.2,
        0,
        Math.PI * 2,
      );
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
    const cell = MathUtils.toCellCoord(ext);

    const isVisible = isCellVisible(state, cell.x, cell.y);
    const isDiscovered = isCellDiscovered(state, cell.x, cell.y);

    if (!isVisible && !isDiscovered && !state.settings.debugOverlayEnabled)
      return;

    const isTactical = this.sharedState.unitStyle === "TacticalIcons";

    if (isTactical) {
      // Tactical Mode: High-contrast geometric overlay (Green Grid)
      ctx.fillStyle = "rgba(0, 255, 0, 0.2)";
      ctx.fillRect(x, y, cellSize, cellSize);
      ctx.strokeStyle = this.theme.getColor("--color-success");
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);

      // Add a crosshair or grid pattern inside
      ctx.beginPath();
      ctx.moveTo(x + cellSize / 2, y + 5);
      ctx.lineTo(x + cellSize / 2, y + cellSize - 5);
      ctx.moveTo(x + 5, y + cellSize / 2);
      ctx.lineTo(x + cellSize - 5, y + cellSize / 2);
      ctx.stroke();

      // Still draw the Exit icon for clarity if available
      const icon = this.assets.iconImages.Exit;
      if (icon) {
        const iconSize = cellSize * 0.4;
        ctx.drawImage(
          icon,
          x + (cellSize - iconSize) / 2,
          y + (cellSize - iconSize) / 2,
          iconSize,
          iconSize,
        );
      }
    } else {
      // Standard Mode: Use Waypoint Sprite
      ctx.fillStyle = this.theme.getColor("--color-extraction-bg");
      ctx.fillRect(x, y, cellSize, cellSize);

      const sprite = this.assets.getMiscSprite("waypoint");
      if (sprite) {
        ctx.drawImage(sprite, x, y, cellSize, cellSize);
      } else {
        // Fallback
        ctx.strokeStyle = this.theme.getColor("--color-info");
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 5]);
        ctx.strokeRect(x + 5, y + 5, cellSize - 10, cellSize - 10);
        ctx.setLineDash([]);
      }
    }
  }

  private renderSpawnPoints(ctx: CanvasRenderingContext2D, state: GameState) {
    const cellSize = this.sharedState.cellSize;
    const isTactical = this.sharedState.unitStyle === "TacticalIcons";

    state.map.spawnPoints?.forEach((sp) => {
      const x = sp.pos.x * cellSize;
      const y = sp.pos.y * cellSize;
      const cell = MathUtils.toCellCoord(sp.pos);

      const isVisible = isCellVisible(state, cell.x, cell.y);
      const isDiscovered = isCellDiscovered(state, cell.x, cell.y);

      if (!isVisible && !isDiscovered && !state.settings.debugOverlayEnabled)
        return;

      if (isTactical) {
        // Tactical Mode: Distinct abstract icon (Vent/Crosshair)
        ctx.fillStyle = this.theme.getColor("--color-spawn-bg");
        ctx.fillRect(x, y, cellSize, cellSize);

        const icon = this.assets.iconImages.Spawn;
        if (icon) {
          const iconSize = cellSize * 0.6;
          ctx.drawImage(
            icon,
            x + (cellSize - iconSize) / 2,
            y + (cellSize - iconSize) / 2,
            iconSize,
            iconSize,
          );
        } else {
          // Fallback Crosshair
          ctx.strokeStyle = this.theme.getColor("--color-danger");
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(
            x + cellSize / 2,
            y + cellSize / 2,
            cellSize * 0.3,
            0,
            Math.PI * 2,
          );
          ctx.moveTo(x + cellSize * 0.2, y + cellSize / 2);
          ctx.lineTo(x + cellSize * 0.8, y + cellSize / 2);
          ctx.moveTo(x + cellSize / 2, y + cellSize * 0.2);
          ctx.lineTo(x + cellSize / 2, y + cellSize * 0.8);
          ctx.stroke();
        }
      } else {
        // Standard Mode: Use spawn_point WebP sprite
        const sprite = this.assets.getMiscSprite("spawn");
        if (sprite) {
          ctx.drawImage(sprite, x, y, cellSize, cellSize);
        } else {
          // Fallback
          ctx.fillStyle = this.theme.getColor("--color-spawn-bg");
          ctx.fillRect(x, y, cellSize, cellSize);
        }
      }
    });
  }

  private renderLoot(ctx: CanvasRenderingContext2D, state: GameState) {
    const cellSize = this.sharedState.cellSize;
    const isTactical = this.sharedState.unitStyle === "TacticalIcons";

    state.loot?.forEach((loot) => {
      const x = loot.pos.x * cellSize;
      const y = loot.pos.y * cellSize;
      const cell = MathUtils.toCellCoord(loot.pos);
      const isVisible = isCellVisible(state, cell.x, cell.y);
      const isDiscovered = isCellDiscovered(state, cell.x, cell.y);

      if (!isVisible && !isDiscovered && !state.settings.debugOverlayEnabled)
        return;

      if (isTactical) {
        // Tactical Mode: Always use the Star Icon for loot
        const icon = this.assets.iconImages.LootStar;
        if (icon) {
          const iconSize = cellSize * 0.6;
          ctx.drawImage(
            icon,
            x + (cellSize - iconSize) / 2,
            y + (cellSize - iconSize) / 2,
            iconSize,
            iconSize,
          );
        } else {
          // Fallback shape
          ctx.fillStyle = this.theme.getColor("--color-objective-bg");
          ctx.beginPath();
          ctx.arc(
            x + cellSize / 2,
            y + cellSize / 2,
            cellSize * 0.3,
            0,
            Math.PI * 2,
          );
          ctx.fill();
          ctx.strokeStyle = this.theme.getColor("--color-info");
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      } else {
        // Standard Mode: Use Crate or Loot Sprite
        const icon =
          loot.itemId === "scrap_crate"
            ? this.assets.iconImages.Loot
            : this.assets.iconImages.Crate;

        if (icon) {
          const iconSize = cellSize * 0.5;
          ctx.drawImage(
            icon,
            x + (cellSize - iconSize) / 2,
            y + (cellSize - iconSize) / 2,
            iconSize,
            iconSize,
          );
        } else {
          // Fallback
          ctx.fillStyle = this.theme.getColor("--color-objective-bg");
          ctx.fillRect(
            x + cellSize * 0.2,
            y + cellSize * 0.2,
            cellSize * 0.6,
            cellSize * 0.6,
          );
        }
      }
    });
  }

  private renderObjectives(ctx: CanvasRenderingContext2D, state: GameState) {
    const cellSize = this.sharedState.cellSize;
    const isTactical = this.sharedState.unitStyle === "TacticalIcons";

    state.objectives?.forEach((obj) => {
      if (
        obj.state === "Pending" &&
        obj.targetCell &&
        (obj.visible || state.settings.debugOverlayEnabled)
      ) {
        if (
          state.map.extraction &&
          obj.targetCell.x === state.map.extraction.x &&
          obj.targetCell.y === state.map.extraction.y
        )
          return;

        const x = obj.targetCell.x * cellSize;
        const y = obj.targetCell.y * cellSize;

        if (isTactical) {
          // Tactical Mode: Use the Objective Icon (Target/Flag)
          const icon = this.assets.iconImages.Objective;
          if (icon) {
            const iconSize = cellSize * 0.6;
            ctx.drawImage(
              icon,
              x + (cellSize - iconSize) / 2,
              y + (cellSize - iconSize) / 2,
              iconSize,
              iconSize,
            );
          } else {
            ctx.fillStyle = this.theme.getColor("--color-objective-bg");
            ctx.fillRect(x + 4, y + 4, cellSize - 8, cellSize - 8);
          }
        } else {
          // Standard Mode: Use the Data Disk Sprite
          const icon = this.assets.iconImages.ObjectiveDisk;
          if (icon) {
            const iconSize = cellSize * 0.6;
            ctx.drawImage(
              icon,
              x + (cellSize - iconSize) / 2,
              y + (cellSize - iconSize) / 2,
              iconSize,
              iconSize,
            );
          } else {
            // Fallback
            ctx.fillStyle = this.theme.getColor("--color-objective-bg");
            ctx.fillRect(x + 4, y + 4, cellSize - 8, cellSize - 8);
          }
        }
      }
    });
  }
}
