import { GameState } from "./types";

export function isCellVisible(state: GameState, x: number, y: number): boolean {
  if (state.gridState) {
    const idx = y * state.map.width + x;
    if ((state.gridState[idx] & 1) !== 0) return true;
  }
  if (state.visibleCells) {
    return state.visibleCells.includes(`${x},${y}`);
  }
  return false;
}

export function isCellDiscovered(
  state: GameState,
  x: number,
  y: number,
): boolean {
  if (state.gridState) {
    const idx = y * state.map.width + x;
    if ((state.gridState[idx] & 2) !== 0) return true;
  }
  if (state.discoveredCells) {
    return state.discoveredCells.includes(`${x},${y}`);
  }
  return false;
}
