import { GameState, Vector2 } from "../../shared/types";
import { SCRAP_REWARDS, MISSION_SCALING } from "../config/GameConstants";

export class LootManager {
  private lootIdCounter: number = 0;

  /**
   * Spawns a loot item on the map at the given position.
   */
  public spawnLoot(
    state: GameState,
    itemId: string,
    pos: Vector2,
    objectiveId?: string,
  ) {
    const id = `loot-${this.lootIdCounter++}`;
    state.loot = [
      ...(state.loot || []),
      {
        id,
        itemId,
        pos: { ...pos },
        objectiveId,
      },
    ];
  }

  /**
   * Removes a loot item from the game state by its ID.
   */
  public removeLoot(state: GameState, lootId: string) {
    if (!state.loot) return;
    state.loot = state.loot.filter((l) => l.id !== lootId);
  }

  /**
   * Awards scrap to the squad based on the item picked up.
   */
  public awardScrap(state: GameState, itemId: string) {
    if (itemId === "scrap_crate") {
      const isBoss = state.nodeType === "Boss";
      const isElite = state.nodeType === "Elite";
      const multiplier = isBoss
        ? MISSION_SCALING.BOSS_MULTIPLIER
        : isElite
          ? MISSION_SCALING.ELITE_MULTIPLIER
          : MISSION_SCALING.NORMAL_MULTIPLIER;

      const scrapAmount = SCRAP_REWARDS.LOOT_CRATE * multiplier;
      state.stats = {
        ...state.stats,
        scrapGained: state.stats.scrapGained + scrapAmount,
      };
    }
  }
}
