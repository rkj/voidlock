import { MapDefinition, Vector2, Objective, Enemy } from "@src/shared/types";
import { CENTER_OFFSET } from "../constants";

/**
 * Common map-related utility functions.
 */
export class MapUtils {
  /**
   * Checks if a given cell is a valid squad spawn point.
   */
  public static isValidSpawnPoint(map: MapDefinition, cell: Vector2): boolean {
    const cx = Math.floor(cell.x);
    const cy = Math.floor(cell.y);
    return (
      (map.squadSpawns?.some((s) => Math.floor(s.x) === cx && Math.floor(s.y) === cy) ||
      (map.squadSpawn &&
        Math.floor(map.squadSpawn.x) === cx &&
        Math.floor(map.squadSpawn.y) === cy)) ??
      false
    );
  }

  /**
   * Returns all squad spawn points defined for the map.
   * If squadSpawns is present, it is returned (even if empty).
   * Otherwise, if squadSpawn is present, it returns it as a single-element array.
   * Otherwise, returns an empty array.
   */
  public static getSquadSpawns(map: MapDefinition): Vector2[] {
    if (map.squadSpawns) return map.squadSpawns;
    if (map.squadSpawn) return [map.squadSpawn];
    return [];
  }

  /**
   * Resolves the world position of an objective, whether it's tied to a cell or an enemy.
   */
  public static resolveObjectivePosition(
    objective: Objective,
    enemies: Enemy[],
  ): Vector2 | null {
    if (objective.targetCell) {
      return {
        x: objective.targetCell.x + CENTER_OFFSET,
        y: objective.targetCell.y + CENTER_OFFSET,
      };
    } else if (objective.targetEnemyId) {
      const enemy = enemies.find((e) => e.id === objective.targetEnemyId);
      if (enemy) {
        return enemy.pos;
      }
    }

    return null;
  }
}
