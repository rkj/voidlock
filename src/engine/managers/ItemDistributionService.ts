import {
  GameState,
  Vector2,
  LootItem,
  Objective,
  UnitState,
} from "../../shared/types";
import { SpatialGrid } from "../../shared/utils/SpatialGrid";
import { MathUtils } from "../../shared/utils/MathUtils";
import { MOVEMENT } from "../config/GameConstants";
import { VisibleItem } from "../interfaces/AIContext";

/**
 * Handles opportunistic pickup logic and item assignments to units.
 * Extracted from UnitManager to address SRP violation.
 */
export class ItemDistributionService {
  private itemGrid: SpatialGrid<VisibleItem> = new SpatialGrid();
  private lastLootArray?: LootItem[];
  private lastObjectivesArray?: Objective[];

  /**
   * Updates the spatial grid of items and determines item assignments for capable units.
   * @param state The current game state
   * @param claimedObjectives Map of objective IDs to unit IDs that are already pursuing them
   * @returns A map of item IDs to unit IDs representing opportunistic assignments
   */
  public updateItemAssignments(
    state: GameState,
    claimedObjectives: Map<string, string>,
  ): Map<string, string> {
    const itemAssignments = new Map<string, string>(); // itemId -> unitId

    // 1. Update the spatial grid if items have changed
    this.refreshItemGrid(state);

    // 2. Query visible items
    const allVisibleItems = this.getVisibleItems(state);

    // 3. Identify units capable of autonomous pickups
    const capableUnits = state.units.filter((u) => {
      if (
        u.hp <= 0 ||
        u.state === UnitState.Dead ||
        u.state === UnitState.Extracted
      )
        return false;

      // Only consider units that can actually perform autonomous opportunistic pickups
      if (u.archetypeId === "vip") return false;
      if (u.aiEnabled === false) return false;
      if (u.commandQueue.length > 0) return false;

      return true;
    });

    // 4. Assign closest capable units to visible items
    if (capableUnits.length > 0) {
      for (const item of allVisibleItems) {
        // Skip items that are already being pursued or channeled by others
        if (claimedObjectives.has(item.id)) continue;

        // Find closest unit by Euclidean distance
        let closestUnit = capableUnits[0];
        let minDist = MathUtils.getDistance(closestUnit.pos, item.pos);
        for (let i = 1; i < capableUnits.length; i++) {
          const d = MathUtils.getDistance(capableUnits[i].pos, item.pos);
          if (d < minDist) {
            minDist = d;
            closestUnit = capableUnits[i];
          }
        }
        itemAssignments.set(item.id, closestUnit.id);
      }
    }

    return itemAssignments;
  }

  /**
   * Returns the internal item grid for AI context.
   */
  public getItemGrid(): SpatialGrid<VisibleItem> {
    return this.itemGrid;
  }

  /**
   * Refreshes the spatial grid of loot and objectives if they have changed.
   */
  private refreshItemGrid(state: GameState): void {
    if (
      this.lastLootArray !== state.loot ||
      this.lastObjectivesArray !== state.objectives
    ) {
      this.itemGrid.clear();
      if (state.loot) {
        for (const l of state.loot) {
          this.itemGrid.insert(l.pos, {
            id: l.id,
            pos: l.pos,
            mustBeInLOS: true,
            type: "loot",
          });
        }
      }

      if (state.objectives) {
        for (const o of state.objectives) {
          if (
            o.state === "Pending" &&
            (o.kind === "Recover" || o.kind === "Escort" || o.kind === "Kill")
          ) {
            let pos: Vector2 = {
              x: MOVEMENT.CENTER_OFFSET,
              y: MOVEMENT.CENTER_OFFSET,
            };
            if (o.targetCell) {
              pos = {
                x: o.targetCell.x + MOVEMENT.CENTER_OFFSET,
                y: o.targetCell.y + MOVEMENT.CENTER_OFFSET,
              };
            } else if (o.targetEnemyId) {
              const enemy = state.enemies.find((e) => e.id === o.targetEnemyId);
              if (enemy) pos = enemy.pos;
            }
            this.itemGrid.insert(pos, {
              id: o.id,
              pos,
              mustBeInLOS: o.kind === "Recover",
              visible: o.visible,
              type: "objective",
            });
          }
        }
      }
      this.lastLootArray = state.loot;
      this.lastObjectivesArray = state.objectives;
    }
  }

  /**
   * Retrieves all items visible to the squad (either via LOS or marked as always visible).
   */
  private getVisibleItems(state: GameState): VisibleItem[] {
    // Query items in visible cells
    const visibleItemsFromGrid = this.itemGrid.queryByKeys(
      state.visibleCells || [],
    );

    // Include objectives that are marked as visible even if not in a currently visible cell
    const alwaysVisibleObjectives = (state.objectives || [])
      .filter(
        (o) =>
          o.visible &&
          o.state === "Pending" &&
          (o.kind === "Recover" || o.kind === "Escort" || o.kind === "Kill"),
      )
      .map((o) => {
        let pos: Vector2 = {
          x: MOVEMENT.CENTER_OFFSET,
          y: MOVEMENT.CENTER_OFFSET,
        };
        if (o.targetCell) {
          pos = {
            x: o.targetCell.x + MOVEMENT.CENTER_OFFSET,
            y: o.targetCell.y + MOVEMENT.CENTER_OFFSET,
          };
        } else if (o.targetEnemyId) {
          const enemy = state.enemies.find((e) => e.id === o.targetEnemyId);
          if (enemy) pos = enemy.pos;
        }
        return {
          id: o.id,
          pos,
          mustBeInLOS: o.kind === "Recover",
          visible: o.visible,
          type: "objective" as const,
        };
      });

    // Merge and deduplicate by ID
    const allVisibleItemsMap = new Map<string, VisibleItem>();
    for (const item of visibleItemsFromGrid) {
      allVisibleItemsMap.set(item.id, item);
    }
    for (const item of alwaysVisibleObjectives) {
      allVisibleItemsMap.set(item.id, item);
    }

    return Array.from(allVisibleItemsMap.values());
  }
}
