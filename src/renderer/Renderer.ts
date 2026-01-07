import {
  GameState,
  MapDefinition,
  CellType,
  UnitState,
  Vector2,
  Door,
  Objective,
  OverlayOption,
  BoundaryType,
} from "../shared/types";
import { Icons } from "./Icons";
import { VisibilityPolygon } from "./VisibilityPolygon";
import { Graph } from "../engine/Graph";
import { ThemeManager } from "./ThemeManager";

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private cellSize: number = 128; // Increased tile size for M8
  private iconImages: Record<string, HTMLImageElement> = {};
  private unitSprites: Record<string, HTMLImageElement> = {};
  private enemySprites: Record<string, HTMLImageElement> = {};
  private overlayOptions: OverlayOption[] = [];
  private graph: Graph | null = null;
  private currentMapId: string | null = null;
  private theme = ThemeManager.getInstance();

  private readonly UNIT_SPRITE_MAP: Record<string, string> = {
    assault: "soldier_demolition",
    heavy: "soldier_heavy",
    medic: "soldier_medic",
    scout: "soldier_scout",
    vip: "soldier_scout",
  };

  private readonly ENEMY_SPRITE_MAP: Record<string, string> = {
    "Xeno-Mite": "xeno_swarmer_1",
    "Warrior-Drone": "xeno_drone_2",
    "Praetorian-Guard": "xeno_guard_3",
    "Spitter-Acid": "xeno_spitter",
    Hive: "void",
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;

    // Load Icons
    Object.entries(Icons).forEach(([key, src]) => {
      const img = new Image();
      img.src = src;
      this.iconImages[key] = img;
    });

    this.loadSprites();
  }

  private loadSprites() {
    // Load Unit Sprites
    Object.values(this.UNIT_SPRITE_MAP).forEach((logicalName) => {
      if (this.unitSprites[logicalName]) return;
      const url = this.theme.getAssetUrl(logicalName);
      if (url) {
        const img = new Image();
        img.src = url;
        this.unitSprites[logicalName] = img;
      }
    });

    // Load Enemy Sprites
    Object.values(this.ENEMY_SPRITE_MAP).forEach((logicalName) => {
      if (this.enemySprites[logicalName]) return;
      const url = this.theme.getAssetUrl(logicalName);
      if (url) {
        const img = new Image();
        img.src = url;
        this.enemySprites[logicalName] = img;
      }
    });
  }

  public setCellSize(size: number) {
    this.cellSize = size;
  }

  public setOverlay(options: OverlayOption[]) {
    this.overlayOptions = options;
  }

  private syncDoorsToGraph(state: GameState) {
    if (!this.graph || !state.map.doors) return;

    state.map.doors.forEach((door) => {
      if (door.segment.length === 2) {
        const boundary = this.graph?.getBoundary(
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

  public render(state: GameState) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Update Graph if map changed
    const mapId = `${state.map.width}x${state.map.height}-${state.map.cells.length}`;
    if (this.currentMapId !== mapId) {
      this.graph = new Graph(state.map);
      this.currentMapId = mapId;
    }

    this.syncDoorsToGraph(state);

    this.renderMap(state);
    this.renderObjectives(state);
    this.renderUnits(state);
    this.renderEnemies(state);
    if (state.settings.debugOverlayEnabled) {
      this.renderDebugOverlay(state);
    }
    this.renderFog(state);
    if (state.settings.losOverlayEnabled) {
      this.renderLOSOverlay(state);
    }
    this.renderOverlay();
  }

  private renderLOSOverlay(state: GameState) {
    if (!this.graph) return;

    // Render Raycast Lines for Debug
    if (state.settings.debugOverlayEnabled) {
      this.ctx.strokeStyle = this.theme.getColor("--color-los-soldier");
      this.ctx.lineWidth = 1;
      state.units.forEach((u) => {
        if (
          u.hp > 0 &&
          u.state !== UnitState.Extracted &&
          u.state !== UnitState.Dead
        ) {
          state.visibleCells.forEach((cellKey) => {
            const [cx, cy] = cellKey.split(",").map(Number);
            this.ctx.beginPath();
            this.ctx.moveTo(u.pos.x * this.cellSize, u.pos.y * this.cellSize);
            this.ctx.lineTo(
              (cx + 0.5) * this.cellSize,
              (cy + 0.5) * this.cellSize,
            );
            this.ctx.stroke();
          });
        }
      });
    }

    // Render Soldier LOS (Green Gradient)
    state.units.forEach((u) => {
      if (
        u.hp > 0 &&
        u.state !== UnitState.Extracted &&
        u.state !== UnitState.Dead
      ) {
        const polygon = VisibilityPolygon.compute(u.pos, this.graph!);

        if (polygon.length > 0) {
          const x = u.pos.x * this.cellSize;
          const y = u.pos.y * this.cellSize;
          const radius = (state.map.width + state.map.height) * this.cellSize;

          const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
          const colorBase = this.theme.getColor("--color-los-soldier");
          const colorFade = this.theme.getColor("--color-los-soldier-fade");
          gradient.addColorStop(0, colorBase);
          gradient.addColorStop(1, colorFade);

          this.ctx.fillStyle = gradient;
          this.ctx.beginPath();
          this.ctx.moveTo(
            polygon[0].x * this.cellSize,
            polygon[0].y * this.cellSize,
          );
          for (let i = 1; i < polygon.length; i++) {
            this.ctx.lineTo(
              polygon[i].x * this.cellSize,
              polygon[i].y * this.cellSize,
            );
          }
          this.ctx.closePath();
          this.ctx.fill();

          // Optional: Stroke for definition
          this.ctx.strokeStyle = this.theme.getColor("--color-los-soldier");
          this.ctx.lineWidth = 2;
          this.ctx.stroke();
        }
      }
    });

    // Render Enemy LOS (Red Gradient)
    state.enemies.forEach((e) => {
      if (e.hp > 0) {
        const cellKey = `${Math.floor(e.pos.x)},${Math.floor(e.pos.y)}`;
        if (!state.visibleCells.includes(cellKey)) return;

        const radius = (state.map.width + state.map.height) * this.cellSize;
        const polygon = VisibilityPolygon.compute(e.pos, this.graph!);

        if (polygon.length > 0) {
          const x = e.pos.x * this.cellSize;
          const y = e.pos.y * this.cellSize;

          const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
          const colorBase = this.theme.getColor("--color-los-enemy");
          const colorFade = this.theme.getColor("--color-los-enemy-fade");
          gradient.addColorStop(0, colorBase);
          gradient.addColorStop(1, colorFade);

          this.ctx.fillStyle = gradient;
          this.ctx.beginPath();
          this.ctx.moveTo(
            polygon[0].x * this.cellSize,
            polygon[0].y * this.cellSize,
          );
          for (let i = 1; i < polygon.length; i++) {
            this.ctx.lineTo(
              polygon[i].x * this.cellSize,
              polygon[i].y * this.cellSize,
            );
          }
          this.ctx.closePath();
          this.ctx.fill();

          this.ctx.strokeStyle = this.theme.getColor("--color-los-enemy");
          this.ctx.lineWidth = 2;
          this.ctx.stroke();
        }
      }
    });
  }

  private renderOverlay() {
    if (this.overlayOptions.length === 0) return;

    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    this.overlayOptions.forEach((opt) => {
      if (opt.pos) {
        let drawX = opt.pos.x;
        let drawY = opt.pos.y;

        if (Number.isInteger(drawX)) drawX += 0.5;
        if (Number.isInteger(drawY)) drawY += 0.5;

        const cx = drawX * this.cellSize;
        const cy = drawY * this.cellSize;

        // Draw Circle background
        this.ctx.fillStyle = this.theme.getColor("--color-warning"); 
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, 24, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw Key (Large)
        this.ctx.fillStyle = this.theme.getColor("--color-black"); // Contrast on yellow
        this.ctx.font = "bold 32px Arial";
        this.ctx.fillText(opt.key, cx, cy);

        // Draw Label text below
        if (opt.label) {
          this.ctx.fillStyle = this.theme.getColor("--color-text");
          this.ctx.font = "bold 18px Arial";
          this.ctx.shadowColor = this.theme.getColor("--color-black");
          this.ctx.shadowBlur = 4;
          this.ctx.fillText(opt.label, cx, cy + 45);
          this.ctx.shadowBlur = 0; // Reset
        }
      }
    });
  }

  private renderDebugOverlay(state: GameState) {
    const map = state.map;
    this.ctx.fillStyle = this.theme.getColor("--color-text-dim");
    this.ctx.font = "10px Arial";
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "top";

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        this.ctx.fillText(
          `${x},${y}`,
          x * this.cellSize + 2,
          y * this.cellSize + 2,
        );
      }
    }

    // Debug Doors
    map.doors?.forEach((door) => {
      if (door.segment.length !== 2) return;
      const [p1, p2] = door.segment;
      const cx = ((p1.x + p2.x) / 2) * this.cellSize + this.cellSize / 2;
      const cy = ((p1.y + p2.y) / 2) * this.cellSize + this.cellSize / 2;

      this.ctx.fillStyle = this.theme.getColor("--color-hive"); // Purple for debug doors
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillText(door.id, cx + 8, cy);
    });
  }


  private renderMap(state: GameState) {
    const map = state.map;
    const width = map.width * this.cellSize;
    const height = map.height * this.cellSize;

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    // Floor
    map.cells.forEach((cell) => {
      if (cell.type === CellType.Floor) {
        this.ctx.fillStyle = this.theme.getColor("--color-floor");
        this.ctx.fillRect(
          cell.x * this.cellSize,
          cell.y * this.cellSize,
          this.cellSize,
          this.cellSize,
        );

        // Grid lines (faint)
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

    if (!this.graph) return;

    // Draw Walls and Doors
    this.ctx.lineCap = "round";

    // Render Walls (Neon Cyan)
    this.ctx.strokeStyle = this.theme.getColor("--color-wall");
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();

    this.graph.getAllBoundaries().forEach((boundary) => {
      // Only draw permanent walls here. Doors are handled separately.
      if (boundary.type === BoundaryType.Wall) {
        const seg = boundary.getVisualSegment();
        this.ctx.moveTo(seg.p1.x * this.cellSize, seg.p1.y * this.cellSize);
        this.ctx.lineTo(seg.p2.x * this.cellSize, seg.p2.y * this.cellSize);
      }
    });
    this.ctx.stroke();

    // Render Doors
    state.map.doors?.forEach((door) => this.renderDoor(door));
  }

  private renderDoor(door: Door) {
    const doorThickness = this.cellSize / 8; // Thicker
    const doorLength = this.cellSize / 3; // 1/3 width

    if (door.segment.length !== 2) return;
    const [p1, p2] = door.segment;

    const s = this.cellSize;
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
      // Door on right edge of minX cell
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
      // Horizontal on bottom edge of minY cell
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

    this.ctx.lineWidth = doorThickness;

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

    // Colors
    if (door.state === "Locked" || door.targetState === "Locked") {
      this.ctx.strokeStyle = this.theme.getColor("--color-door-locked");
    } else if (door.state === "Destroyed") {
      this.ctx.strokeStyle = this.theme.getColor("--color-door-destroyed");
    } else {
      this.ctx.strokeStyle = this.theme.getColor("--color-door-closed");
      if (openRatio > 0.8) this.ctx.strokeStyle = this.theme.getColor("--color-door-dim");
    }

    if (door.state !== "Destroyed") {
      // Draw two segments sliding apart
      const cx = (startX + endX) / 2;
      const cy = (startY + endY) / 2;

      // Vector along door
      const dx = endX - startX;
      const dy = endY - startY;
      const len = Math.sqrt(dx * dx + dy * dy);
      const ux = dx / len;
      const uy = dy / len;

      // Left Half
      this.ctx.beginPath();
      this.ctx.moveTo(startX, startY);
      this.ctx.lineTo(cx - ux * slideOffset, cy - uy * slideOffset);
      this.ctx.stroke();

      // Right Half
      this.ctx.beginPath();
      this.ctx.moveTo(endX, endY);
      this.ctx.lineTo(cx + ux * slideOffset, cy + uy * slideOffset);
      this.ctx.stroke();

      // Draw struts
      this.ctx.lineWidth = 2; // Match regular wall width
      this.ctx.strokeStyle = this.theme.getColor("--color-wall");

      this.ctx.beginPath();
      this.ctx.moveTo(strut1_sx, strut1_sy);
      this.ctx.lineTo(strut1_ex, strut1_ey);
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.moveTo(strut2_sx, strut2_sy);
      this.ctx.lineTo(strut2_ex, strut2_ey);
      this.ctx.stroke();
    }
  }

  private renderObjectives(state: GameState) {
    if (state.map.extraction) {
      const ext = state.map.extraction;
      const x = ext.x * this.cellSize;
      const y = ext.y * this.cellSize;

      // Extraction Zone
      this.ctx.fillStyle = this.theme.getColor("--color-extraction-bg");
      this.ctx.fillRect(x, y, this.cellSize, this.cellSize);

      this.ctx.strokeStyle = this.theme.getColor("--color-info");
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([10, 5]);
      this.ctx.strokeRect(x + 5, y + 5, this.cellSize - 10, this.cellSize - 10);
      this.ctx.setLineDash([]);

      // Icon
      const icon = this.iconImages.Exit;
      if (icon) {
        const iconSize = this.cellSize * 0.6;
        this.ctx.drawImage(
          icon,
          x + (this.cellSize - iconSize) / 2,
          y + (this.cellSize - iconSize) / 2,
          iconSize,
          iconSize,
        );
      }
    }

    state.map.spawnPoints?.forEach((sp) => {
      const x = sp.pos.x * this.cellSize;
      const y = sp.pos.y * this.cellSize;

      // Only render if discovered or visible, or debug
      const key = `${Math.floor(sp.pos.x)},${Math.floor(sp.pos.y)}`;
      const isKnown =
        state.discoveredCells.includes(key) || state.visibleCells.includes(key);

      if (!isKnown && !state.settings.debugOverlayEnabled) return;

      this.ctx.fillStyle = this.theme.getColor("--color-spawn-bg");
      this.ctx.fillRect(x, y, this.cellSize, this.cellSize);

      const icon = this.iconImages.Spawn;
      if (icon) {
        const iconSize = this.cellSize * 0.5;
        this.ctx.drawImage(
          icon,
          x + (this.cellSize - iconSize) / 2,
          y + (this.cellSize - iconSize) / 2,
          iconSize,
          iconSize,
        );
      }
    });

    state.objectives?.forEach((obj) => {
      if (obj.state === "Pending" && obj.targetCell && obj.visible) {
        // Skip objective if it's at the extraction point (redundant visual)
        if (
          state.map.extraction &&
          obj.targetCell.x === state.map.extraction.x &&
          obj.targetCell.y === state.map.extraction.y
        ) {
          return;
        }

        const x = obj.targetCell.x * this.cellSize;
        const y = obj.targetCell.y * this.cellSize;

        this.ctx.fillStyle = this.theme.getColor("--color-objective-bg");
        this.ctx.fillRect(x + 4, y + 4, this.cellSize - 8, this.cellSize - 8);

        const icon = this.iconImages.Objective;
        if (icon) {
          const iconSize = this.cellSize * 0.6;
          this.ctx.drawImage(
            icon,
            x + (this.cellSize - iconSize) / 2,
            y + (this.cellSize - iconSize) / 2,
            iconSize,
            iconSize,
          );
        }
      }
    });
  }

  private renderUnits(state: GameState) {
    state.units.forEach((unit, index) => {
      if (unit.state === UnitState.Extracted || unit.state === UnitState.Dead)
        return;

      const x = unit.pos.x * this.cellSize;
      const y = unit.pos.y * this.cellSize;

      const logicalName = this.UNIT_SPRITE_MAP[unit.archetypeId];
      const sprite = logicalName ? this.unitSprites[logicalName] : null;

      if (sprite && sprite.complete && sprite.naturalWidth > 0) {
        const spriteSize = this.cellSize * 0.8;
        this.ctx.drawImage(
          sprite,
          x - spriteSize / 2,
          y - spriteSize / 2,
          spriteSize,
          spriteSize,
        );
      } else {
        // Fallback to geometric shape
        this.ctx.beginPath();
        // Unit size: 1/6 radius = 1/3 diameter relative to cell.
        // 128 / 6 ~= 21px radius -> 42px diameter.
        this.ctx.arc(x, y, this.cellSize / 6, 0, Math.PI * 2);

        if (unit.state === UnitState.Channeling) {
          this.ctx.fillStyle = this.theme.getColor("--color-info");
        } else if (unit.state === UnitState.Attacking) {
          this.ctx.fillStyle = this.theme.getColor("--color-danger");
        } else if (unit.state === UnitState.Moving) {
          this.ctx.fillStyle = this.theme.getColor("--color-door-closed");
        } else {
          this.ctx.fillStyle = this.theme.getColor("--color-primary");
        }

        this.ctx.fill();
        this.ctx.strokeStyle = this.theme.getColor("--color-black"); // Contrast
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
      }

      // Render Burdened Indicator
      if (unit.carriedObjectiveId) {
        this.ctx.fillStyle = this.theme.getColor("--color-danger");
        this.ctx.font = `bold ${Math.floor(this.cellSize / 10)}px monospace`;
        this.ctx.fillText("BURDENED", x, y - this.cellSize / 4);
      }

      // Render Soldier Number
      this.ctx.fillStyle = this.theme.getColor("--color-black"); // Contrast
      this.ctx.font = `bold ${Math.floor(this.cellSize / 8)}px monospace`;
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText((index + 1).toString(), x, y);

      this.renderHealthBar(x, y, unit.hp, unit.maxHp);


      if (unit.state === UnitState.Channeling && unit.channeling) {
        this.renderChannelingBar(
          x,
          y,
          unit.channeling.remaining,
          unit.channeling.totalDuration,
        );
      }

      if (unit.state === UnitState.Moving && unit.targetPos) {
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

        this.ctx.strokeStyle = this.theme.getColor("--color-hive");
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([10, 10]);

        let currX = x;
        let currY = y;

        pathPoints.forEach((p, idx) => {
          const nextX = p.x * this.cellSize;
          const nextY = p.y * this.cellSize;

          // Dimmer further from the soldier
          const alpha = Math.max(
            0.1,
            1.0 - idx / Math.max(pathPoints.length, 5),
          );
          this.ctx.globalAlpha = alpha;

          this.ctx.beginPath();
          this.ctx.moveTo(currX, currY);
          this.ctx.lineTo(nextX, nextY);
          this.ctx.stroke();

          currX = nextX;
          currY = nextY;
        });

        this.ctx.globalAlpha = 1.0;
        this.ctx.setLineDash([]);
      }

      if (
        unit.lastAttackTarget &&
        unit.lastAttackTime &&
        state.t - unit.lastAttackTime < 150
      ) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(
          unit.lastAttackTarget.x * this.cellSize,
          unit.lastAttackTarget.y * this.cellSize,
        );
        this.ctx.strokeStyle = this.theme.getColor("--color-warning");
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
      }
    });
  }

  private renderEnemies(state: GameState) {
    state.enemies.forEach((enemy) => {
      if (enemy.hp <= 0) return;

      const cellKey = `${Math.floor(enemy.pos.x)},${Math.floor(enemy.pos.y)}`;
      if (!state.visibleCells.includes(cellKey)) return;

      const x = enemy.pos.x * this.cellSize;
      const y = enemy.pos.y * this.cellSize;
      const size = this.cellSize / 6;

      const logicalName = this.ENEMY_SPRITE_MAP[enemy.type];
      const sprite = logicalName ? this.enemySprites[logicalName] : null;

      if (sprite && sprite.complete && sprite.naturalWidth > 0) {
        const spriteSize = this.cellSize * 0.8;
        this.ctx.drawImage(
          sprite,
          x - spriteSize / 2,
          y - spriteSize / 2,
          spriteSize,
          spriteSize,
        );
      } else {
        // Fallback to geometric shapes
        this.ctx.beginPath();
        if (enemy.type === "Hive") {
          // Hive: Special Icon
          const icon = this.iconImages.Hive;
          if (icon) {
            const hiveSize = this.cellSize * 0.8;
            this.ctx.drawImage(
              icon,
              x - hiveSize / 2,
              y - hiveSize / 2,
              hiveSize,
              hiveSize,
            );
          } else {
            // Fallback
            this.ctx.fillStyle = this.theme.getColor("--color-hive");
            const hiveSize = this.cellSize * 0.6;
            this.ctx.rect(
              x - hiveSize / 2,
              y - hiveSize / 2,
              hiveSize,
              hiveSize,
            );
            this.ctx.fill();
          }
        } else {
          // Regular Enemy Shapes based on Type
          if (enemy.type === "Xeno-Mite") {
            // Triangle
            this.ctx.moveTo(x, y - size);
            this.ctx.lineTo(x + size, y + size);
            this.ctx.lineTo(x - size, y + size);
          } else if (enemy.type === "Warrior-Drone") {
            // Diamond
            this.ctx.moveTo(x, y - size * 1.2);
            this.ctx.lineTo(x + size * 1.2, y);
            this.ctx.lineTo(x, y + size * 1.2);
            this.ctx.lineTo(x - size * 1.2, y);
          } else if (enemy.type === "Spitter-Acid") {
            // Octagon
            for (let i = 0; i < 8; i++) {
              const angle = (i * Math.PI) / 4;
              const px = x + Math.cos(angle) * size * 1.1;
              const py = y + Math.sin(angle) * size * 1.1;
              if (i === 0) this.ctx.moveTo(px, py);
              else this.ctx.lineTo(px, py);
            }
          } else if (enemy.type === "Praetorian-Guard") {
            // Hexagon (Large)
            for (let i = 0; i < 6; i++) {
              const angle = (i * Math.PI) / 3;
              const px = x + Math.cos(angle) * size * 1.5;
              const py = y + Math.sin(angle) * size * 1.5;
              if (i === 0) this.ctx.moveTo(px, py);
              else this.ctx.lineTo(px, py);
            }
          } else {
            // Default: Triangle
            this.ctx.moveTo(x, y - size);
            this.ctx.lineTo(x + size, y + size);
            this.ctx.lineTo(x - size, y + size);
          }
          this.ctx.closePath();

          this.ctx.fillStyle = this.theme.getColor("--color-danger");
          this.ctx.fill();
          this.ctx.strokeStyle = this.theme.getColor("--color-black"); // Contrast
          this.ctx.lineWidth = 3;
          this.ctx.stroke();

          // Render Difficulty Number
          if (enemy.difficulty) {
            this.ctx.fillStyle = this.theme.getColor("--color-text");
            this.ctx.font = `bold ${Math.floor(this.cellSize / 10)}px monospace`;
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(enemy.difficulty.toString(), x, y);
          }
        }
      }

      this.renderHealthBar(x, y, enemy.hp, enemy.maxHp);

      if (
        enemy.lastAttackTarget &&
        enemy.lastAttackTime &&
        state.t - enemy.lastAttackTime < 150
      ) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(
          enemy.lastAttackTarget.x * this.cellSize,
          enemy.lastAttackTarget.y * this.cellSize,
        );
        this.ctx.strokeStyle = this.theme.getColor("--color-warning");
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
      }
    });
  }


  private renderHealthBar(x: number, y: number, hp: number, maxHp: number) {
    const barWidth = this.cellSize * 0.5;
    const barHeight = 6;
    const yOffset = -this.cellSize / 6 - 12;

    this.ctx.fillStyle = this.theme.getColor("--color-black"); // Background
    this.ctx.fillRect(x - barWidth / 2, y + yOffset, barWidth, barHeight);

    const pct = Math.max(0, hp / maxHp);
    this.ctx.fillStyle = pct > 0.5 ? this.theme.getColor("--color-success") : pct > 0.25 ? this.theme.getColor("--color-warning") : this.theme.getColor("--color-danger");
    this.ctx.fillRect(x - barWidth / 2, y + yOffset, barWidth * pct, barHeight);
  }


  private renderChannelingBar(
    x: number,
    y: number,
    remaining: number,
    total: number,
  ) {
    const barWidth = this.cellSize * 0.6;
    const barHeight = 6;
    const yOffset = -this.cellSize / 6 - 22; // Above health bar

    // Background
    this.ctx.fillStyle = this.theme.getColor("--color-black");
    this.ctx.fillRect(x - barWidth / 2, y + yOffset, barWidth, barHeight);

    // Progress
    const pct = Math.max(0, 1 - remaining / total);
    this.ctx.fillStyle = this.theme.getColor("--color-info");
    this.ctx.fillRect(x - barWidth / 2, y + yOffset, barWidth * pct, barHeight);

    // Border
    this.ctx.strokeStyle = this.theme.getColor("--color-white");
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x - barWidth / 2, y + yOffset, barWidth, barHeight);
  }

  private renderFog(state: GameState) {
    if (state.settings.debugOverlayEnabled) return;

    const map = state.map;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const key = `${x},${y}`;
        const isVisible = state.visibleCells.includes(key);
        const isDiscovered = state.discoveredCells.includes(key);

        if (isVisible) continue;

        if (isDiscovered) {
          this.ctx.fillStyle = this.theme.getColor("--color-fog-discovered");
          this.ctx.fillRect(
            x * this.cellSize,
            y * this.cellSize,
            this.cellSize,
            this.cellSize,
          );
        } else {
          this.ctx.fillStyle = this.theme.getColor("--color-fog-unexplored");
          this.ctx.fillRect(
            x * this.cellSize,
            y * this.cellSize,
            this.cellSize,
            this.cellSize,
          );
        }
      }
    }
  }

  public getCellCoordinates(pixelX: number, pixelY: number): Vector2 {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const x = Math.floor(((pixelX - rect.left) * scaleX) / this.cellSize);
    const y = Math.floor(((pixelY - rect.top) * scaleY) / this.cellSize);
    return { x, y };
  }
}
