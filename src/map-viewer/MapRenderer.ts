import { MapDefinition, CellType, Vector2 } from "../shared/types";
import { Graph } from "../engine/Graph";
import { ThemeManager } from "../renderer/ThemeManager";

export class MapRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private cellSize: number = 64;
  private graph: Graph | null = null;
  private currentMapId: string | null = null;
  private theme = ThemeManager.getInstance();
  private showCoordinates: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not get 2D rendering context for canvas.");
    }
    this.ctx = ctx;
  }

  public setCellSize(size: number) {
    this.cellSize = size;
  }

  public setShowCoordinates(show: boolean) {
    this.showCoordinates = show;
  }

  public toSVG(map: MapDefinition): string {
    const width = map.width * this.cellSize;
    const height = map.height * this.cellSize;
    const bg = "#0a0a0a"; // Background for the map area
    const floor = this.theme.getColor("--color-floor");
    const grid = this.theme.getColor("--color-grid");
    const wall = this.theme.getColor("--color-wall");
    const info = this.theme.getColor("--color-info");
    const objective = this.theme.getColor("--color-objective");
    const hive = this.theme.getColor("--color-hive");
    const textDim = this.theme.getColor("--color-text-dim");

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background-color: ${bg}">\n`;

    // Cells
    map.cells.forEach((cell) => {
      if (cell.type === CellType.Floor) {
        const x = cell.x * this.cellSize;
        const y = cell.y * this.cellSize;
        svg += `  <rect x="${x}" y="${y}" width="${this.cellSize}" height="${this.cellSize}" fill="${floor}" stroke="${grid}" stroke-width="1" />\n`;
      }
    });

    // Walls
    if (this.graph) {
      svg += `  <g stroke="${wall}" stroke-width="2" stroke-linecap="round">\n`;
      this.graph.getAllBoundaries().forEach((boundary) => {
        if (boundary.isWall && !boundary.doorId) {
          const seg = boundary.getVisualSegment();
          svg += `    <line x1="${seg.p1.x * this.cellSize}" y1="${seg.p1.y * this.cellSize}" x2="${seg.p2.x * this.cellSize}" y2="${seg.p2.y * this.cellSize}" />\n`;
        }
      });
      svg += `  </g>\n`;
    }

    // Doors
    map.doors?.forEach((door) => {
      const state = door.state || "Closed";
      if (state === "Open") return; // Simplified: don't draw open door frames for now, matching canvas logic mostly

      let doorColor = this.theme.getColor("--color-door-closed");
      let doorStroke = this.theme.getColor("--color-door-dim");

      if (state === "Locked") {
        doorColor = this.theme.getColor("--color-door-locked");
        doorStroke = this.theme.getColor("--color-danger");
      } else if (state === "Destroyed") {
        doorColor = this.theme.getColor("--color-door-destroyed");
        doorStroke = this.theme.getColor("--color-door-destroyed");
      }

      const doorThickness = this.cellSize / 8;
      const doorInset = this.cellSize / 8;

      door.segment.forEach((segCell) => {
        const x = segCell.x * this.cellSize;
        const y = segCell.y * this.cellSize;
        const s = this.cellSize;

        let drawX, drawY, drawWidth, drawHeight;

        if (door.orientation === "Vertical") {
          drawX = x + s - doorThickness / 2;
          drawY = y + doorInset;
          drawWidth = doorThickness;
          drawHeight = s - doorInset * 2;
        } else {
          drawX = x + doorInset;
          drawY = y + s - doorThickness / 2;
          drawWidth = s - doorInset * 2;
          drawHeight = doorThickness;
        }

        svg += `  <rect x="${drawX}" y="${drawY}" width="${drawWidth}" height="${drawHeight}" fill="${doorColor}" stroke="${doorStroke}" stroke-width="2" />\n`;
        
        if (state === "Locked") {
          svg += `  <line x1="${drawX}" y1="${drawY}" x2="${drawX + drawWidth}" y2="${drawY + drawHeight}" stroke="${doorStroke}" stroke-width="2" />\n`;
          svg += `  <line x1="${drawX + drawWidth}" y1="${drawY}" x2="${drawX}" y2="${drawY + drawHeight}" stroke="${doorStroke}" stroke-width="2" />\n`;
        }
      });
    });

    // Extraction & Objectives
    if (map.extraction) {
      const ext = map.extraction;
      svg += `  <rect x="${ext.x * this.cellSize + 4}" y="${ext.y * this.cellSize + 4}" width="${this.cellSize - 8}" height="${this.cellSize - 8}" fill="${info}" fill-opacity="0.3" />\n`;
      svg += `  <text x="${ext.x * this.cellSize + this.cellSize / 2}" y="${ext.y * this.cellSize + this.cellSize / 2}" fill="${info}" font-family="monospace" font-weight="bold" font-size="${this.cellSize / 2}" text-anchor="middle" dominant-baseline="central">E</text>\n`;
    }

    map.objectives?.forEach((obj) => {
      if (obj.targetCell) {
        svg += `  <rect x="${obj.targetCell.x * this.cellSize + 4}" y="${obj.targetCell.y * this.cellSize + 4}" width="${this.cellSize - 8}" height="${this.cellSize - 8}" fill="${objective}" fill-opacity="0.3" />\n`;
        svg += `  <text x="${obj.targetCell.x * this.cellSize + this.cellSize / 2}" y="${obj.targetCell.y * this.cellSize + this.cellSize / 2}" fill="${objective}" font-family="monospace" font-weight="bold" font-size="${this.cellSize / 2}" text-anchor="middle" dominant-baseline="central">O</text>\n`;
      }
    });

    // Spawn Points
    map.spawnPoints?.forEach((sp) => {
      const x = sp.pos.x * this.cellSize;
      const y = sp.pos.y * this.cellSize;
      svg += `  <circle cx="${x}" cy="${y}" r="${this.cellSize * 0.4}" fill="${hive}" fill-opacity="0.3" />\n`;
      svg += `  <text x="${x}" y="${y}" fill="${hive}" font-family="monospace" font-weight="bold" font-size="${this.cellSize / 3}" text-anchor="middle" dominant-baseline="central">S</text>\n`;
    });

    // Coordinates
    if (this.showCoordinates) {
      map.cells.forEach((cell) => {
        if (cell.type === CellType.Floor) {
          svg += `  <text x="${cell.x * this.cellSize + 2}" y="${cell.y * this.cellSize + 2}" fill="${textDim}" font-family="monospace" font-size="${this.cellSize / 5}" text-anchor="start" dominant-baseline="hanging">${cell.x},${cell.y}</text>\n`;
        }
      });
    }

    svg += "</svg>";
    return svg;
  }

  public render(map: MapDefinition) {
    const width = map.width * this.cellSize;
    const height = map.height * this.cellSize;

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    // Update Graph if map changed
    const mapId = `${map.width}x${map.height}-${map.cells.length}`;
    if (this.currentMapId !== mapId) {
      this.graph = new Graph(map);
      this.currentMapId = mapId;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.renderCells(map);
    this.renderWalls(map);
    this.renderDoors(map);
    this.renderObjectives(map);
    this.renderSpawnPoints(map);

    if (this.showCoordinates) {
      this.renderDebugCoordinates(map);
    }
  }

  private renderCells(map: MapDefinition) {
    map.cells.forEach((cell) => {
      if (cell.type === CellType.Floor) {
        this.ctx.fillStyle = this.theme.getColor("--color-floor");
        this.ctx.fillRect(
          cell.x * this.cellSize,
          cell.y * this.cellSize,
          this.cellSize,
          this.cellSize,
        );

        // Grid lines
        this.ctx.strokeStyle = this.theme.getColor("--color-grid");
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(
          cell.x * this.cellSize,
          cell.y * this.cellSize,
          this.cellSize,
          this.cellSize,
        );
      }
    });
  }

  private renderWalls(map: MapDefinition) {
    if (!this.graph) return;

    this.ctx.lineCap = "round";
    // Draw Walls
    this.ctx.strokeStyle = this.theme.getColor("--color-wall");
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();

    this.graph.getAllBoundaries().forEach((boundary) => {
      if (boundary.isWall && !boundary.doorId) {
        const seg = boundary.getVisualSegment();
        this.ctx.moveTo(seg.p1.x * this.cellSize, seg.p1.y * this.cellSize);
        this.ctx.lineTo(seg.p2.x * this.cellSize, seg.p2.y * this.cellSize);
      }
    });
    this.ctx.stroke();
  }

  private renderDoors(map: MapDefinition) {
    map.doors?.forEach((door) => {
      let doorColor: string = this.theme.getColor("--color-text-dim");
      let doorStroke: string = this.theme.getColor("--color-text-muted");

      // Default to Closed if state is somehow missing or simplified
      const state = door.state || "Closed";

      if (state === "Closed") {
        doorColor = this.theme.getColor("--color-door-closed");
        doorStroke = this.theme.getColor("--color-door-dim");
      } else if (state === "Locked") {
        doorColor = this.theme.getColor("--color-door-locked");
        doorStroke = this.theme.getColor("--color-danger");
      } else if (state === "Destroyed") {
        doorColor = this.theme.getColor("--color-door-destroyed");
        doorStroke = this.theme.getColor("--color-door-destroyed");
      }

      const doorThickness = this.cellSize / 8;
      const doorInset = this.cellSize / 8;

      door.segment.forEach((segCell) => {
        const x = segCell.x * this.cellSize;
        const y = segCell.y * this.cellSize;
        const s = this.cellSize;

        let drawX = x,
          drawY = y,
          drawWidth = s,
          drawHeight = s;

        if (state === "Open") {
          this.ctx.fillStyle = this.theme.getColor("--color-border-strong");
          if (door.orientation === "Vertical") {
            this.ctx.fillRect(x + s - 4, y, 4, doorInset);
            this.ctx.fillRect(x + s - 4, y + s - doorInset, 4, doorInset);
          } else {
            this.ctx.fillRect(x, y + s - 4, doorInset, 4);
            this.ctx.fillRect(x + s - doorInset, y + s - 4, doorInset, 4);
          }
        } else {
          this.ctx.fillStyle = doorColor;
          this.ctx.strokeStyle = doorStroke;
          this.ctx.lineWidth = 2;

          if (door.orientation === "Vertical") {
            drawX = x + s - doorThickness / 2;
            drawY = y + doorInset;
            drawWidth = doorThickness;
            drawHeight = s - doorInset * 2;
          } else {
            drawX = x + doorInset;
            drawY = y + s - doorThickness / 2;
            drawWidth = s - doorInset * 2;
            drawHeight = doorThickness;
          }

          this.ctx.fillRect(drawX, drawY, drawWidth, drawHeight);
          this.ctx.strokeRect(drawX, drawY, drawWidth, drawHeight);

          if (state === "Locked") {
            this.ctx.beginPath();
            this.ctx.moveTo(drawX, drawY);
            this.ctx.lineTo(drawX + drawWidth, drawY + drawHeight);
            this.ctx.moveTo(drawX + drawWidth, drawY);
            this.ctx.lineTo(drawX, drawY + drawHeight);
            this.ctx.stroke();
          }
        }
      });
    });
  }

  private renderObjectives(map: MapDefinition) {
    if (map.extraction) {
      const ext = map.extraction;
      this.ctx.fillStyle = this.theme.getColor("--color-info");
      this.ctx.globalAlpha = 0.3;
      this.ctx.fillRect(
        ext.x * this.cellSize + 4,
        ext.y * this.cellSize + 4,
        this.cellSize - 8,
        this.cellSize - 8,
      );
      this.ctx.globalAlpha = 1.0;

      // Label 'E'
      this.ctx.fillStyle = this.theme.getColor("--color-info");
      this.ctx.font = `bold ${this.cellSize / 2}px monospace`;
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(
        "E",
        ext.x * this.cellSize + this.cellSize / 2,
        ext.y * this.cellSize + this.cellSize / 2,
      );
    }

    map.objectives?.forEach((obj) => {
      if (obj.targetCell) {
        this.ctx.fillStyle = this.theme.getColor("--color-objective");
        this.ctx.globalAlpha = 0.3;
        this.ctx.fillRect(
          obj.targetCell.x * this.cellSize + 4,
          obj.targetCell.y * this.cellSize + 4,
          this.cellSize - 8,
          this.cellSize - 8,
        );
        this.ctx.globalAlpha = 1.0;

        // Label 'O'
        this.ctx.fillStyle = this.theme.getColor("--color-objective");
        this.ctx.font = `bold ${this.cellSize / 2}px monospace`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(
          "O",
          obj.targetCell.x * this.cellSize + this.cellSize / 2,
          obj.targetCell.y * this.cellSize + this.cellSize / 2,
        );
      }
    });
  }

  private renderSpawnPoints(map: MapDefinition) {
    map.spawnPoints?.forEach((sp) => {
      this.ctx.fillStyle = this.theme.getColor("--color-hive");
      this.ctx.globalAlpha = 0.3;
      // Spawn point is a radius, usually 1?
      // Just render a circle at pos
      const x = sp.pos.x * this.cellSize;
      const y = sp.pos.y * this.cellSize;

      this.ctx.beginPath();
      this.ctx.arc(x, y, this.cellSize * 0.4, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = 1.0;

      // Label 'S'
      this.ctx.fillStyle = this.theme.getColor("--color-hive");
      this.ctx.font = `bold ${this.cellSize / 3}px monospace`;
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText("S", x, y);
    });
  }

  private renderDebugCoordinates(map: MapDefinition) {
    this.ctx.fillStyle = this.theme.getColor("--color-text-dim");
    this.ctx.font = `${this.cellSize / 5}px monospace`;
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "top";

    map.cells.forEach((cell) => {
      if (cell.type === CellType.Floor) {
        this.ctx.fillText(
          `${cell.x},${cell.y}`,
          cell.x * this.cellSize + 2,
          cell.y * this.cellSize + 2,
        );
      }
    });
  }
}
