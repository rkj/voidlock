import { Bot } from './Bot';
import { GameState, Command, CommandType, UnitState } from '../shared/types';

export class SimpleBot implements Bot {
  act(state: GameState): Command | null {
    const idleUnits = state.units.filter(u => u.state === UnitState.Idle);
    if (idleUnits.length === 0) return null;

    // 1. Objectives
    const objective = state.objectives.find(o => o.kind === 'Recover' && o.state === 'Pending');
    if (objective && objective.targetCell) {
        const unit = idleUnits[0];
        return {
            type: CommandType.MOVE_TO,
            unitIds: [unit.id],
            target: objective.targetCell
        };
    }

    // 2. Extraction
    if (state.map.extraction) {
        const unit = idleUnits[0];
        const allObjectivesDone = state.objectives.every(o => o.state === 'Completed');
        if (allObjectivesDone) {
             return {
                type: CommandType.MOVE_TO,
                unitIds: [unit.id],
                target: state.map.extraction
            };
        }
    }

    return null;
  }
}
