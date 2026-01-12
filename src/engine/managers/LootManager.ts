import { GameState, LootItem, Vector2 } from "../../shared/types";

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
      const multiplier = isBoss ? 3 : isElite ? 2 : 1;

      // Approx 20% of base mission value (which is 125 * multiplier)
      // 125 * 0.2 = 25
      const scrapAmount = 25 * multiplier;
      state.stats.scrapGained += scrapAmount;
    }
  }
}
