import {
  BoundaryDefinition,
  BoundaryType,
  CellType,
  GameState,
  ItemLibrary,
  Objective,
  OverlayOption,
  UnitState,
  WeaponLibrary,
} from "@src/shared/types";
import { RoomDiscoveryManager } from "./RoomDiscoveryManager";
import { isCellVisible, isCellDiscovered } from "@src/shared/VisibilityUtils";

export type OverlayType =
  | "CELL"
  | "ITEM"
  | "INTERSECTION"
  | "FRIENDLY_UNIT"
  | "ESCORT_TARGET"
  | "HOSTILE_UNIT"
  | "PLACEMENT_POINT";

/**
 * Handles generation of tactical map overlays for target selection.
 */
export class TargetOverlayGenerator {
  /**
   * Generates a list of overlay options based on the requested type and current game state.
   */
  public static generate(
    type: OverlayType,
    gameState: GameState,
    discovery: RoomDiscoveryManager,
  ): OverlayOption[] {
    const options: OverlayOption[] = [];

    if (type === "HOSTILE_UNIT") {
      let enemyCounter = 0;
      gameState.enemies.forEach((e) => {
        if (isCellVisible(gameState, Math.floor(e.pos.x), Math.floor(e.pos.y))) {
          options.push({
            key: this.getRoomKey(enemyCounter),
            label: `${e.type}`,
            pos: { x: Math.floor(e.pos.x), y: Math.floor(e.pos.y) },
            id: e.id,
          });
          enemyCounter++;
        }
      });
    } else if (type === "ITEM") {
      let itemCounter = 0;
      gameState.objectives.forEach((obj) => {
        if (obj.state === "Pending" && obj.visible && obj.targetCell) {
          options.push({
            key: this.getRoomKey(itemCounter),
            label: `Collect ${this.getObjectiveLabel(obj)}`,
            pos: obj.targetCell,
            id: obj.id,
          });
          itemCounter++;
        }
      });

      if (gameState.loot) {
        gameState.loot.forEach((loot) => {
          if (
            isCellVisible(
              gameState,
              Math.floor(loot.pos.x),
              Math.floor(loot.pos.y),
            )
          ) {
            const item = ItemLibrary[loot.itemId] || WeaponLibrary[loot.itemId];
            const itemName = item?.name || loot.itemId;
            options.push({
              key: this.getRoomKey(itemCounter),
              label: `Pickup ${itemName}`,
              pos: { x: Math.floor(loot.pos.x), y: Math.floor(loot.pos.y) },
              id: loot.id,
            });
            itemCounter++;
          }
        });
      }
    } else if (type === "FRIENDLY_UNIT" || type === "ESCORT_TARGET") {
      let unitCounter = 0;
      gameState.units.forEach((u, idx) => {
        if (u.state !== UnitState.Dead && u.state !== UnitState.Extracted) {
          // If ESCORT_TARGET, only show VIPs or Artifact Carriers
          if (type === "ESCORT_TARGET") {
            const isVip = u.archetypeId === "vip";
            const isCarrier = !!u.carriedObjectiveId;
            if (!isVip && !isCarrier) return;
          }

          const tacticalNumber = u.tacticalNumber || (idx + 1);
          const displayName = u.name || u.id;
          options.push({
            key: this.getRoomKey(unitCounter),
            label: `${displayName} (${tacticalNumber})`,
            pos: { x: Math.floor(u.pos.x), y: Math.floor(u.pos.y) },
            id: u.id,
          });
          unitCounter++;
        }
      });
    } else if (type === "INTERSECTION") {
      let intersectionCounter = 0;
      gameState.map.cells.forEach((cell) => {
        if (cell.type !== CellType.Floor) return;
        if (!isCellDiscovered(gameState, cell.x, cell.y)) return;

        // Count connections (boundaries that are NOT walls)
        let connections = 0;
        const boundaries = (gameState.map.boundaries || []).filter(
          (b: BoundaryDefinition) =>
            (b.x1 === cell.x && b.y1 === cell.y) ||
            (b.x2 === cell.x && b.y2 === cell.y),
        );

        boundaries.forEach((b: BoundaryDefinition) => {
          if (b.type === BoundaryType.Open || b.type === BoundaryType.Door) connections++;
        });

        // Intersections (3-4) or Dead Ends (1)
        if (connections === 1 || connections >= 3) {
          options.push({
            key: this.getRoomKey(intersectionCounter),
            label: connections === 1 ? "Dead End" : `Intersection`,
            pos: { x: cell.x, y: cell.y },
          });
          intersectionCounter++;
        }
      });
    } else if (type === "PLACEMENT_POINT") {
      const placementPositions = new Set<string>();

      const isRoom = (c: { roomId?: string }) =>
        !!c.roomId && !c.roomId.startsWith("corridor-");

      // 1. Current Soldier Position
      gameState.units.forEach((u) => {
        if (u.state !== UnitState.Dead && u.state !== UnitState.Extracted) {
          const ux = Math.floor(u.pos.x);
          const uy = Math.floor(u.pos.y);
          placementPositions.add(`${ux},${uy}`);
        }
      });

      // 2. Corridor Intersections
      gameState.map.cells.forEach((cell) => {
        if (cell.type !== CellType.Floor) return;
        if (!isCellDiscovered(gameState, cell.x, cell.y)) return;

        const cellIsRoom = isRoom(cell);
        if (cellIsRoom) return; // Strictly corridor only for intersections

        // Get boundaries for this cell
        const cellBoundaries = (gameState.map.boundaries || []).filter(
          (b: BoundaryDefinition) =>
            (b.x1 === cell.x && b.y1 === cell.y) ||
            (b.x2 === cell.x && b.y2 === cell.y),
        );

        // Count connections (Open or Door)
        let connections = 0;
        cellBoundaries.forEach((b: BoundaryDefinition) => {
          if (b.type === BoundaryType.Open || b.type === BoundaryType.Door) {
            connections++;
          }
        });

        // Corridor Intersection
        if (connections >= 3) {
          placementPositions.add(`${cell.x},${cell.y}`);
        }
      });

      let placementCounter = 0;
      // Sort keys to ensure deterministic ordering (important for UI menu keys)
      const sortedPositions = Array.from(placementPositions).sort((a, b) => {
        const [ax, ay] = a.split(",").map(Number);
        const [bx, by] = b.split(",").map(Number);
        return ay !== by ? ay - by : ax - bx;
      });

      sortedPositions.forEach((posKey) => {
        const [x, y] = posKey.split(",").map(Number);
        options.push({
          key: this.getRoomKey(placementCounter),
          label: `Place Mine`,
          pos: { x, y },
        });
        placementCounter++;
      });
    } else if (type === "CELL") {
      // Add Rooms in Discovery Order FIRST to ensure stable keys 1, 2, etc.
      discovery.update(gameState);

      discovery.roomOrder.forEach((roomId, index) => {
        const center = discovery.getRoomCenter(roomId);
        if (!center) return;

        const key = this.getRoomKey(index);
        options.push({
          key: key,
          label: `Room ${key}`,
          pos: center,
        });
      });

      // Other POIs come after rooms
      let poiCounter = discovery.roomOrder.length;

      if (gameState.map.extraction) {
        const ext = gameState.map.extraction;
        if (isCellDiscovered(gameState, ext.x, ext.y)) {
          options.push({
            key: this.getRoomKey(poiCounter),
            label: "Extraction",
            pos: ext,
          });
          poiCounter++;
        }
      }

      gameState.objectives.forEach((obj) => {
        if (obj.state === "Pending" && obj.visible && obj.targetCell) {
          // Avoid double-counting if objective is at extraction (already handled in renderer, but here for keys)
          if (
            gameState.map.extraction &&
            obj.targetCell.x === gameState.map.extraction.x &&
            obj.targetCell.y === gameState.map.extraction.y
          ) {
            return;
          }

          options.push({
            key: this.getRoomKey(poiCounter),
            label: this.getObjectiveLabel(obj),
            pos: obj.targetCell,
          });
          poiCounter++;
        }
      });
    }

    return options;
  }

  private static getObjectiveLabel(obj: Objective): string {
    const id = obj.id.toLowerCase();
    if (id.includes("artifact")) return "Artifact";
    if (id.includes("intel")) return "Intel";
    if (id.includes("hive")) return "Xeno Hive";
    if (id.includes("escort")) return "Extraction";
    return obj.kind === "Recover" ? "Objective" : obj.kind;
  }

  private static getRoomKey(index: number): string {
    if (index < 9) return (index + 1).toString();
    return String.fromCharCode(65 + (index - 9)); // 65 is 'A'
  }
}
