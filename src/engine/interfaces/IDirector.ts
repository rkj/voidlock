import { GameState, UseItemCommand } from "../../shared/types";

export interface IDirector {
  handleUseItem(state: GameState, cmd: UseItemCommand): void;
  getThreatLevel(): number;
  update(dt: number): void;
  preSpawn(): void;
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
