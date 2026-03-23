import type {
  BoundaryDefinition,
  GameState,
  Objective,
  OverlayOption} from "@src/shared/types";
import {
  BoundaryType,
  CellType,
  ItemLibrary,
  UnitState,
  WeaponLibrary,
} from "@src/shared/types";
import type { RoomDiscoveryManager } from "./RoomDiscoveryManager";
import { isCellVisible, isCellDiscovered } from "@src/shared/VisibilityUtils";
import { MathUtils } from "@src/shared/utils/MathUtils";

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
    switch (type) {
      case "HOSTILE_UNIT": return this.generateHostileUnit(gameState);
      case "ITEM": return this.generateItem(gameState);
      case "FRIENDLY_UNIT":
      case "ESCORT_TARGET": return this.generateFriendlyUnit(type, gameState);
      case "INTERSECTION": return this.generateIntersection(gameState);
      case "PLACEMENT_POINT": return this.generatePlacementPoint(gameState);
      case "CELL": return this.generateCell(gameState, discovery);
    }
  }

  private static generateHostileUnit(gameState: GameState): OverlayOption[] {
    const options: OverlayOption[] = [];
    let enemyCounter = 0;
    gameState.enemies.forEach((e) => {
      const cell = MathUtils.toCellCoord(e.pos);
      if (isCellVisible(gameState, cell.x, cell.y)) {
        options.push({ key: this.getRoomKey(enemyCounter), label: `${e.type}`, pos: cell, id: e.id });
        enemyCounter++;
      }
    });
    return options;
  }

  private static generateItem(gameState: GameState): OverlayOption[] {
    const options: OverlayOption[] = [];
    let itemCounter = 0;
    gameState.objectives.forEach((obj) => {
      if (obj.state === "Pending" && obj.visible && obj.targetCell) {
        options.push({ key: this.getRoomKey(itemCounter), label: `Collect ${this.getObjectiveLabel(obj)}`, pos: obj.targetCell, id: obj.id });
        itemCounter++;
      }
    });
    if (gameState.loot) {
      gameState.loot.forEach((loot) => {
        const cell = MathUtils.toCellCoord(loot.pos);
        if (isCellDiscovered(gameState, cell.x, cell.y)) {
          const item = ItemLibrary[loot.itemId] || WeaponLibrary[loot.itemId];
          const itemName = item?.name || loot.itemId;
          options.push({ key: this.getRoomKey(itemCounter), label: `Pickup ${itemName}`, pos: cell, id: loot.id });
          itemCounter++;
        }
      });
    }
    return options;
  }

  private static generateFriendlyUnit(type: OverlayType, gameState: GameState): OverlayOption[] {
    const options: OverlayOption[] = [];
    let unitCounter = 0;
    gameState.units.forEach((u, idx) => {
      if (u.state !== UnitState.Dead && u.state !== UnitState.Extracted) {
        if (type === "ESCORT_TARGET") {
          const isVip = u.archetypeId === "vip";
          const isCarrier = !!u.carriedObjectiveId;
          if (!isVip && !isCarrier) return;
        }
        const tacticalNumber = u.tacticalNumber || idx + 1;
        const displayName = u.name || u.id;
        options.push({ key: this.getRoomKey(unitCounter), label: `${displayName} (${tacticalNumber})`, pos: MathUtils.toCellCoord(u.pos), id: u.id });
        unitCounter++;
      }
    });
    return options;
  }

  private static generateIntersection(gameState: GameState): OverlayOption[] {
    const options: OverlayOption[] = [];
    let intersectionCounter = 0;
    gameState.map.cells.forEach((cell) => {
      if (cell.type !== CellType.Floor) return;
      if (!isCellDiscovered(gameState, cell.x, cell.y)) return;
      let connections = 0;
      const boundaries = (gameState.map.boundaries ?? []).filter(
        (b: BoundaryDefinition) => (b.x1 === cell.x && b.y1 === cell.y) || (b.x2 === cell.x && b.y2 === cell.y),
      );
      boundaries.forEach((b: BoundaryDefinition) => {
        if (b.type === BoundaryType.Open || b.type === BoundaryType.Door) connections++;
      });
      if (connections === 1 || connections >= 3) {
        options.push({ key: this.getRoomKey(intersectionCounter), label: connections === 1 ? "Dead End" : `Intersection`, pos: { x: cell.x, y: cell.y } });
        intersectionCounter++;
      }
    });
    return options;
  }

  private static generatePlacementPoint(gameState: GameState): OverlayOption[] {
    const placementPositions = new Set<string>();
    const isRoom = (c: { roomId?: string }) => !!c.roomId && !c.roomId.startsWith("corridor-");

    gameState.units.forEach((u) => {
      if (u.state !== UnitState.Dead && u.state !== UnitState.Extracted) {
        placementPositions.add(MathUtils.cellKey(u.pos));
      }
    });

    gameState.map.cells.forEach((cell) => {
      if (cell.type !== CellType.Floor) return;
      if (!isCellDiscovered(gameState, cell.x, cell.y)) return;
      if (isRoom(cell)) return;

      const cellBoundaries = (gameState.map.boundaries ?? []).filter(
        (b: BoundaryDefinition) => (b.x1 === cell.x && b.y1 === cell.y) || (b.x2 === cell.x && b.y2 === cell.y),
      );
      let connections = 0;
      cellBoundaries.forEach((b: BoundaryDefinition) => {
        if (b.type === BoundaryType.Open || b.type === BoundaryType.Door) connections++;
      });
      if (connections >= 3) placementPositions.add(`${cell.x},${cell.y}`);
    });

    const options: OverlayOption[] = [];
    let placementCounter = 0;
    const sortedPositions = Array.from(placementPositions).sort((a, b) => {
      const [ax, ay] = a.split(",").map(Number);
      const [bx, by] = b.split(",").map(Number);
      return ay !== by ? ay - by : ax - bx;
    });
    sortedPositions.forEach((posKey) => {
      const [x, y] = posKey.split(",").map(Number);
      options.push({ key: this.getRoomKey(placementCounter), label: `Place Mine`, pos: { x, y } });
      placementCounter++;
    });
    return options;
  }

  private static generateCell(gameState: GameState, discovery: RoomDiscoveryManager): OverlayOption[] {
    const options: OverlayOption[] = [];
    discovery.update(gameState);

    discovery.roomOrder.forEach((roomId, index) => {
      const center = discovery.getRoomCenter(roomId);
      if (!center) return;
      const key = this.getRoomKey(index);
      options.push({ key, label: `Room ${key}`, pos: center });
    });

    let poiCounter = discovery.roomOrder.length;
    if (gameState.map.extraction) {
      const ext = gameState.map.extraction;
      if (isCellDiscovered(gameState, ext.x, ext.y)) {
        options.push({ key: this.getRoomKey(poiCounter), label: "Extraction", pos: ext });
        poiCounter++;
      }
    }

    gameState.objectives.forEach((obj) => {
      if (obj.state === "Pending" && obj.visible && obj.targetCell) {
        if (obj.targetCell.x === gameState.map.extraction?.x && obj.targetCell.y === gameState.map.extraction.y) return;
        options.push({ key: this.getRoomKey(poiCounter), label: this.getObjectiveLabel(obj), pos: obj.targetCell });
        poiCounter++;
      }
    });

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
