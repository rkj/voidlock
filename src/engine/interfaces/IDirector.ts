import { GameState, UseItemCommand } from "../../shared/types";

export interface ItemEffectHandler {
  handleUseItem(state: GameState, cmd: UseItemCommand): void;
}

export interface ThreatDirector {
  getThreatLevel(): number;
  preSpawn(): void;
  update(dt: number): void;
}

export interface IDirector extends ItemEffectHandler, ThreatDirector {
  getState(): {
    turn: number;
    timeInCurrentTurn: number;
    enemyIdCounter: number;
  };
  setState(state: {
    turn: number;
    timeInCurrentTurn: number;
    enemyIdCounter: number;
  }): void;
}
