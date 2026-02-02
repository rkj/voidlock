import { Unit, Vector2 } from "../../shared/types";
import { GameGrid } from "../GameGrid";
import { MathUtils } from "../../shared/utils/MathUtils";

export interface EscortSlot {
  targetCell: Vector2;
  matchedSpeed?: number;
  stopEscorting?: boolean;
}

export class FormationManager {
  /**
   * Assigns escort roles and target slots to units following a target unit (e.g., a VIP).
   *
   * The formation is dynamic and rotates based on the target's current heading:
   * 1. Vanguard (Index 0): Positioned directly in front of the target.
   * 2. Rearguard (Index 1): Positioned directly behind the target.
   * 3. Bodyguards (Index 2+): Positioned to the sides of the target, alternating left/right
   *    and spreading out if multiple bodyguards are present.
   *
   * Escorts synchronize their speed with the target when they are close to their assigned slots.
   */
  public assignEscortRoles(
    escorts: Unit[],
    targetUnit: Unit,
    gameGrid: GameGrid,
  ): Map<string, EscortSlot> {
    const escortData = new Map<string, EscortSlot>();

    // Sort escorts by ID for stable role assignment
    escorts.sort((a, b) => a.id.localeCompare(b.id));

    // Determine target's heading
    let heading = { x: 0, y: -1 }; // Default North
    if (targetUnit.targetPos) {
      const dist = MathUtils.getDistance(targetUnit.pos, targetUnit.targetPos);
      if (dist > 0.1) {
        heading = {
          x: (targetUnit.targetPos.x - targetUnit.pos.x) / dist,
          y: (targetUnit.targetPos.y - targetUnit.pos.y) / dist,
        };
      }
    } else if (targetUnit.path && targetUnit.path.length > 0) {
      const targetPoint = {
        x: targetUnit.path[0].x + 0.5,
        y: targetUnit.path[0].y + 0.5,
      };
      const dist = MathUtils.getDistance(targetUnit.pos, targetPoint);
      if (dist > 0.1) {
        heading = {
          x: (targetPoint.x - targetUnit.pos.x) / dist,
          y: (targetPoint.y - targetUnit.pos.y) / dist,
        };
      }
    }

    const perp = { x: -heading.y, y: heading.x };

    escorts.forEach((escort, index) => {
      let formationOffset = { x: 0, y: 0 };
      if (index === 0) {
        // Vanguard
        formationOffset = {
          x: Math.round(heading.x),
          y: Math.round(heading.y),
        };
      } else if (index === 1) {
        // Rearguard
        formationOffset = {
          x: -Math.round(heading.x),
          y: -Math.round(heading.y),
        };
      } else {
        // Bodyguard
        const side = (index - 2) % 2 === 0 ? 1 : -1;
        const depth = Math.floor((index - 2) / 2);
        // Stay adjacent (left or right)
        formationOffset = {
          x: Math.round(perp.x * side),
          y: Math.round(perp.y * side),
        };
        if (depth > 0) {
          // If many bodyguards, push them back slightly to spread out
          formationOffset.x -= Math.round(heading.x * depth);
          formationOffset.y -= Math.round(heading.y * depth);
        }
      }

      const targetCell = {
        x: Math.floor(targetUnit.pos.x) + formationOffset.x,
        y: Math.floor(targetUnit.pos.y) + formationOffset.y,
      };

      // Validate target cell
      if (!gameGrid.isWalkable(targetCell.x, targetCell.y)) {
        // Fallback to target's cell if formation slot is blocked
        targetCell.x = Math.floor(targetUnit.pos.x);
        targetCell.y = Math.floor(targetUnit.pos.y);
      }

      let matchedSpeed: number | undefined = undefined;
      const distToSlot = MathUtils.getDistance(escort.pos, {
        x: targetCell.x + 0.5,
        y: targetCell.y + 0.5,
      });
      if (distToSlot <= 0.8) {
        matchedSpeed = Math.min(escort.stats.speed, targetUnit.stats.speed);
      }

      escortData.set(escort.id, { targetCell, matchedSpeed });
    });

    return escortData;
  }
}
