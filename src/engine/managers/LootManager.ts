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
}
