import { GameState, UnitState } from "../../shared/types";
import { LineOfSight } from "../LineOfSight";

export class VisibilityManager {
  constructor(private los: LineOfSight) {}

  public updateVisibility(state: GameState) {
    const width = state.map.width;
    const height = state.map.height;
    const size = width * height;

    if (!state.gridState || state.gridState.length !== size) {
      state.gridState = new Uint8Array(size);
    }

    // Sync back from discoveredCells if it was manually mutated (for tests)
    // We check length to see if something was added manually
    let bitsetDiscoveredCount = 0;
    for (let i = 0; i < size; i++) {
      if (state.gridState[i] & 2) bitsetDiscoveredCount++;
    }

    if (state.discoveredCells && state.discoveredCells.length > bitsetDiscoveredCount) {
      state.discoveredCells.forEach((key) => {
        const parts = key.split(",");
        const x = parseInt(parts[0]);
        const y = parseInt(parts[1]);
        if (x >= 0 && x < width && y >= 0 && y < height) {
          state.gridState![y * width + x] |= 2; // bit 1: discovered
        }
      });
    }

    // Reset current visibility (bit 0)
    for (let i = 0; i < size; i++) {
      state.gridState[i] &= ~1;
    }

    state.units.forEach((unit) => {
      if (
        unit.hp > 0 &&
        unit.state !== UnitState.Extracted &&
        unit.state !== UnitState.Dead
      ) {
        this.los.updateVisibleCells(
          unit.pos,
          state.gridState!,
          width,
          height,
          undefined,
        );
      }
    });

    // Still populate string arrays for now to avoid breaking renderer/tests
    // We can optimize this by only doing it if a flag is set, or just migrating the renderer.
    const visibleArr: string[] = [];
    const discoveredArr: string[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const val = state.gridState[y * width + x];
        if (val & 1) visibleArr.push(`${x},${y}`);
        if (val & 2) discoveredArr.push(`${x},${y}`);
      }
    }
    state.visibleCells = visibleArr;
    state.discoveredCells = discoveredArr;
  }
}
