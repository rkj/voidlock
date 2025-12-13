import { GameState, Command } from '../shared/types';

export interface Bot {
  act(state: GameState): Command | null;
}
