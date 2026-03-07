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
    return (
      (map.squadSpawns?.some((s) => s.x === cell.x && s.y === cell.y) ||
      (map.squadSpawn?.x === cell.x && map.squadSpawn?.y === cell.y)) ??
      false
    );
  }

  /**
   * Resolves the world position of an objective, whether it's tied to a cell or an enemy.
   */
  public static resolveObjectivePosition(
    objective: Objective,
    enemies: Enemy[],
  ): Vector2 {
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

    return {
      x: CENTER_OFFSET,
      y: CENTER_OFFSET,
    };
  }
}
