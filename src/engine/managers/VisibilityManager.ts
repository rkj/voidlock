import { GameState, UnitState } from "../../shared/types";
import { LineOfSight } from "../LineOfSight";

export class VisibilityManager {
  constructor(private los: LineOfSight) {}

  public updateVisibility(state: GameState) {
    const newVisibleCells = new Set<string>();
    state.units.forEach((unit) => {
      if (
        unit.hp > 0 &&
        unit.state !== UnitState.Extracted &&
        unit.state !== UnitState.Dead
      ) {
        const visible = this.los.computeVisibleCells(unit.pos);
        visible.forEach((cell) => newVisibleCells.add(cell));
      }
    });
    state.visibleCells = Array.from(newVisibleCells);

    const discoveredSet = new Set(state.discoveredCells);
    newVisibleCells.forEach((cell) => discoveredSet.add(cell));
    state.discoveredCells = Array.from(discoveredSet);
  }
}
