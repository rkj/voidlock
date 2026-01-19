import {
  BoundaryDefinition,
  BoundaryType,
  CellType,
  GameState,
  OverlayOption,
  UnitState,
} from "@src/shared/types";
import { RoomDiscoveryManager } from "./RoomDiscoveryManager";

export type OverlayType =
  | "CELL"
  | "ITEM"
  | "INTERSECTION"
  | "FRIENDLY_UNIT"
  | "HOSTILE_UNIT";

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
        const key = `${Math.floor(e.pos.x)},${Math.floor(e.pos.y)}`;
        if (gameState.visibleCells.includes(key)) {
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
            label: `Collect ${obj.kind}`,
            pos: obj.targetCell,
            id: obj.id,
          });
          itemCounter++;
        }
      });

      if (gameState.loot) {
        gameState.loot.forEach((loot) => {
          const key = `${Math.floor(loot.pos.x)},${Math.floor(loot.pos.y)}`;
          if (gameState.visibleCells.includes(key)) {
            options.push({
              key: this.getRoomKey(itemCounter),
              label: `Pickup ${loot.itemId}`,
              pos: { x: Math.floor(loot.pos.x), y: Math.floor(loot.pos.y) },
              id: loot.id,
            });
            itemCounter++;
          }
        });
      }
    } else if (type === "FRIENDLY_UNIT") {
      let unitCounter = 0;
      gameState.units.forEach((u) => {
        if (u.state !== UnitState.Dead && u.state !== UnitState.Extracted) {
          options.push({
            key: this.getRoomKey(unitCounter),
            label: `${u.id}`,
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
        const key = `${cell.x},${cell.y}`;
        if (!gameState.discoveredCells.includes(key)) return;

        // Count connections (boundaries that are NOT walls)
        let connections = 0;
        const boundaries = (gameState.map.boundaries || []).filter(
          (b: BoundaryDefinition) =>
            (b.x1 === cell.x && b.y1 === cell.y) ||
            (b.x2 === cell.x && b.y2 === cell.y),
        );

        boundaries.forEach((b: BoundaryDefinition) => {
          if (b.type === BoundaryType.Open) connections++;
        });

        if (connections >= 3) {
          options.push({
            key: this.getRoomKey(intersectionCounter),
            label: `Intersection`,
            pos: { x: cell.x, y: cell.y },
          });
          intersectionCounter++;
        }
      });
    } else if (type === "CELL") {
      // Add Rooms in Discovery Order FIRST to ensure stable keys 1, 2, etc.
      discovery.update(gameState);

      discovery.roomOrder.forEach((roomId, index) => {
        const cellsInRoom = gameState.map.cells.filter(
          (c) => c.roomId === roomId,
        );
        if (cellsInRoom.length === 0) return;

        // Find rough center
        const avgX =
          cellsInRoom.reduce((sum, c) => sum + c.x, 0) / cellsInRoom.length;
        const avgY =
          cellsInRoom.reduce((sum, c) => sum + c.y, 0) / cellsInRoom.length;
        // Find cell closest to center
        const centerCell = cellsInRoom.reduce((prev, curr) => {
          const prevDist = (prev.x - avgX) ** 2 + (prev.y - avgY) ** 2;
          const currDist = (curr.x - avgX) ** 2 + (curr.y - avgY) ** 2;
          return currDist < prevDist ? curr : prev;
        });

        const key = this.getRoomKey(index);
        options.push({
          key: key,
          label: `Room ${key}`,
          pos: { x: centerCell.x, y: centerCell.y },
        });
      });

      // Other POIs come after rooms
      let poiCounter = discovery.roomOrder.length;

      if (gameState.map.extraction) {
        const ext = gameState.map.extraction;
        const key = `${ext.x},${ext.y}`;
        if (gameState.discoveredCells.includes(key)) {
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
            label: `Obj ${obj.id}`,
            pos: obj.targetCell,
          });
          poiCounter++;
        }
      });
    }

    return options;
  }

  private static getRoomKey(index: number): string {
    if (index < 9) return (index + 1).toString();
    return String.fromCharCode(65 + (index - 9)); // 65 is 'A'
  }
}
