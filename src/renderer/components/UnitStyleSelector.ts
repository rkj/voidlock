import { UnitStyle } from "@src/shared/types";
import { AssetManager } from "../visuals/AssetManager";
import { ThemeManager } from "../ThemeManager";

export class UnitStyleSelector {
  private container: HTMLElement | null;
  private currentStyle: UnitStyle;
  private onChange: (style: UnitStyle) => void;

  constructor(
    container: HTMLElement | null,
    private themeManager: ThemeManager,
    initialStyle: UnitStyle,
    onChange: (style: UnitStyle) => void,
  ) {
    this.container = container;
    this.currentStyle = initialStyle;
    this.onChange = onChange;
  }

  public render() {
    if (!this.container) return;
    this.container.innerHTML = "";
    this.container.className = "style-preview-container";

    const styles = [
      { id: UnitStyle.TacticalIcons, label: "Tactical Icons" },
      { id: UnitStyle.Sprites, label: "Sprites" },
    ];

    styles.forEach((style) => {
      const item = document.createElement("div");
      item.className = "style-preview-item";
      if (this.currentStyle === style.id) {
        item.classList.add("active");
      }
      item.setAttribute("data-style", style.id);
      item.tabIndex = 0;

      const box = document.createElement("div");
      box.className = "style-preview-box";

      const canvas = document.createElement("canvas");
      canvas.id = `preview-canvas-${style.id.toLowerCase()}`;
      canvas.width = 128;
      canvas.height = 128;
      box.appendChild(canvas);

      const label = document.createElement("span");
      label.className = "style-preview-label";
      label.textContent = style.label;

      item.appendChild(box);
      item.appendChild(label);

      item.onclick = () => {
        this.currentStyle = style.id as UnitStyle;
        this.updateActiveState();
        this.onChange(this.currentStyle);
      };

      item.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          this.currentStyle = style.id as UnitStyle;
          this.updateActiveState();
          this.onChange(this.currentStyle);
          e.preventDefault();
        }
      };

      if (this.container) {
        this.container.appendChild(item);
      }
    });

    this.renderPreviews();
  }

  public setStyle(style: UnitStyle) {
    this.currentStyle = style;
    this.updateActiveState();
    this.renderPreviews();
  }

  private updateActiveState() {
    if (!this.container) return;
    const items = this.container.querySelectorAll(".style-preview-item");
    items.forEach((item) => {
      const style = item.getAttribute("data-style") as UnitStyle;
      if (style === this.currentStyle) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });
  }

  public renderPreviews() {
    if (!this.container) return;
    const tacticalCanvas = this.container.querySelector(
      "#preview-canvas-tacticalicons",
    ) as HTMLCanvasElement;
    const spritesCanvas = this.container.querySelector(
      "#preview-canvas-sprites",
    ) as HTMLCanvasElement;

    if (tacticalCanvas)
      this.drawPreview(tacticalCanvas, UnitStyle.TacticalIcons);
    if (spritesCanvas) this.drawPreview(spritesCanvas, UnitStyle.Sprites);
  }

  private getColor(key: string, fallback: string): string {
    if (this.themeManager?.getColor) {
      return this.themeManager.getColor(key);
    }
    return fallback;
  }

  private drawPreview(canvas: HTMLCanvasElement, style: UnitStyle) {
    const ctx = canvas.getContext("2d");
    if (!ctx || !ctx.fillRect) return;

    const { width, height } = canvas;
    const cellSize = width / 2; // Preview as 2x2 grid

    ctx.clearRect(0, 0, width, height);

    // Draw 2x2 grid background
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        ctx.fillStyle = this.getColor("--color-floor", "#111");
        ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
        ctx.strokeStyle = this.getColor("--color-grid", "#333");
        ctx.lineWidth = 1;
        ctx.strokeRect(c * cellSize, r * cellSize, cellSize, cellSize);
      }
    }

    // Top-Left (0,0): Friendly Soldier
    this.drawEntity(ctx, 0, 0, cellSize, style, "soldier");

    // Top-Right (1,0): Hostile Enemy
    this.drawEntity(ctx, 1, 0, cellSize, style, "enemy");

    // Bottom-Left (0,1): Mission Objective/Loot
    this.drawEntity(ctx, 0, 1, cellSize, style, "objective");

    // Bottom-Right (1,1): Extraction/Exit
    this.drawEntity(ctx, 1, 1, cellSize, style, "extraction");
  }

  private drawEntity(
    ctx: CanvasRenderingContext2D,
    col: number,
    row: number,
    cellSize: number,
    style: UnitStyle,
    type: "soldier" | "enemy" | "objective" | "extraction",
  ) {
    const x = col * cellSize + cellSize / 2;
    const y = row * cellSize + cellSize / 2;

    if (style === UnitStyle.TacticalIcons) {
      this.drawTacticalEntity(ctx, x, y, cellSize, type);
    } else {
      this.drawSpriteEntity(ctx, x, y, cellSize, type);
    }
  }

  private drawTacticalEntity(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    cellSize: number,
    type: string,
  ) {
    const iconSize = cellSize * 0.4;

    switch (type) {
      case "soldier":
        ctx.beginPath();
        ctx.arc(x, y, iconSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = this.getColor("--color-primary", "#0f0");
        ctx.fill();
        ctx.strokeStyle = this.getColor("--color-black", "#000");
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = this.getColor("--color-black", "#000");
        ctx.font = `bold ${Math.floor(iconSize * 0.6)}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("1", x, y);
        break;
      case "enemy":
        ctx.beginPath();
        ctx.moveTo(x, y - iconSize / 2);
        ctx.lineTo(x + iconSize / 2, y + iconSize / 2);
        ctx.lineTo(x - iconSize / 2, y + iconSize / 2);
        ctx.closePath();
        ctx.fillStyle = this.getColor("--color-danger", "#f00");
        ctx.fill();
        ctx.strokeStyle = this.getColor("--color-black", "#000");
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = this.getColor("--color-black", "#000");
        ctx.font = `bold ${Math.floor(iconSize * 0.5)}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("A", x, y + iconSize * 0.15);
        break;
      case "objective":
        ctx.fillStyle = this.getColor("--color-objective", "#ff0");
        ctx.beginPath();
        ctx.moveTo(x, y - iconSize / 2);
        ctx.lineTo(x + iconSize / 2, y);
        ctx.lineTo(x, y + iconSize / 2);
        ctx.lineTo(x - iconSize / 2, y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = this.getColor("--color-black", "#000");
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
      case "extraction":
        ctx.strokeStyle = this.getColor("--color-info", "#0af");
        ctx.lineWidth = 3;
        ctx.strokeRect(x - iconSize / 2, y - iconSize / 2, iconSize, iconSize);
        ctx.fillStyle = "rgba(0, 255, 255, 0.2)";
        ctx.fillRect(x - iconSize / 2, y - iconSize / 2, iconSize, iconSize);
        break;
    }
  }

  private drawSpriteEntity(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    cellSize: number,
    type: string,
  ) {
    const assets = AssetManager.getInstance();
    let sprite: HTMLImageElement | null = null;
    const spriteSize = cellSize * 0.6;

    switch (type) {
      case "soldier":
        sprite = assets.getUnitSprite("scout");
        break;
      case "enemy":
        sprite = assets.getEnemySprite("warrior-drone");
        break;
      case "objective":
        sprite = assets.getIcon("ObjectiveDisk");
        break;
      case "extraction":
        sprite = assets.getMiscSprite("waypoint");
        break;
    }

    if (sprite) {
      if (sprite.complete && sprite.naturalWidth > 0) {
        ctx.drawImage(
          sprite,
          x - spriteSize / 2,
          y - spriteSize / 2,
          spriteSize,
          spriteSize,
        );

        if (type === "soldier") {
          ctx.font = `bold ${Math.floor(spriteSize * 0.5)}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.strokeStyle = this.getColor("--color-black", "#000");
          ctx.lineWidth = 3;
          ctx.strokeText("1", x, y);
          ctx.fillStyle = this.getColor("--color-white", "#fff");
          ctx.fillText("1", x, y);
        } else if (type === "enemy") {
          ctx.font = `bold ${Math.floor(spriteSize * 0.5)}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.strokeStyle = this.getColor("--color-black", "#000");
          ctx.lineWidth = 3;
          ctx.strokeText("A", x, y);
          ctx.fillStyle = this.getColor("--color-danger", "#f00");
          ctx.fillText("A", x, y);
        }
      } else {
        // Fallback while loading
        ctx.fillStyle = this.getColor("--color-text-dim", "#888");
        ctx.font = "12px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Loading...", x, y);

        // Use addEventListener to avoid overwriting other listeners on the same singleton sprite
        const onAssetLoad = () => {
          const canvas = ctx.canvas;
          const style = canvas.id.includes("tactical")
            ? UnitStyle.TacticalIcons
            : UnitStyle.Sprites;
          this.drawPreview(canvas, style);
          sprite?.removeEventListener("load", onAssetLoad);
        };
        sprite.addEventListener("load", onAssetLoad);
      }
    } else {
      // Missing asset placeholder
      this.drawMissingPlaceholder(ctx, x, y, spriteSize);
    }
  }

  private drawMissingPlaceholder(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
  ) {
    ctx.strokeStyle = "#f0f"; // Magenta for missing
    ctx.lineWidth = 2;
    ctx.strokeRect(x - size / 2, y - size / 2, size, size);
    ctx.beginPath();
    ctx.moveTo(x - size / 2, y - size / 2);
    ctx.lineTo(x + size / 2, y + size / 2);
    ctx.moveTo(x + size / 2, y - size / 2);
    ctx.lineTo(x - size / 2, y + size / 2);
    ctx.stroke();

    ctx.fillStyle = "#f0f";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", x, y);
  }
}
