import { GameState, Vector2 } from "../../shared/types";
import { SCRAP_REWARDS, MISSION_SCALING } from "../config/GameConstants";

export class LootManager {
  private lootIdCounter: number = 0;

  public spawnLoot(
    state: GameState,
    itemId: string,
    pos: Vector2,
    objectiveId?: string,
  ) {
    if (!state.loot) {
      state.loot = [];
    }
    const id = `loot-${this.lootIdCounter++}`;
    state.loot.push({
      id,
      itemId,
      pos: { ...pos },
      objectiveId,
    });
  }

  public removeLoot(state: GameState, lootId: string) {
    if (!state.loot) return;
    state.loot = state.loot.filter((l) => l.id !== lootId);
  }

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
      state.stats.scrapGained += scrapAmount;
    }
  }
}