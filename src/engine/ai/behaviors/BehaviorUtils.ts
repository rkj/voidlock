import {
  Vector2,
  GameState,
  Unit,
  UnitState,
  Door,
} from "../../../shared/types";
import { GameGrid } from "../../GameGrid";
import { isCellDiscovered } from "../../../shared/VisibilityUtils";

export function getDistance(pos1: Vector2, pos2: Vector2): number {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function isMapFullyDiscovered(
  state: GameState,
  totalFloorCells: number,
  gameGrid: GameGrid,
): boolean {
  if (state.gridState) {
    let discoveredFloors = 0;
    const width = state.map.width;
    const height = state.map.height;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if ((state.gridState[y * width + x] & 2) && gameGrid.isWalkable(x, y)) {
          discoveredFloors++;
        }
      }
    }
    return discoveredFloors >= totalFloorCells;
  }
  const discoveredFloors = state.discoveredCells.filter((key) => {
    const parts = key.split(",");
    const x = parseInt(parts[0]);
    const y = parseInt(parts[1]);
    return gameGrid.isWalkable(x, y);
  }).length;
  return discoveredFloors >= totalFloorCells;
}

export function findClosestUndiscoveredCell(
  unit: Unit,
  state: GameState,
  _gridState: Uint8Array | undefined,
  doors: Map<string, Door>,
  gameGrid: GameGrid,
): Vector2 | null {
  const startX = Math.floor(unit.pos.x);
  const startY = Math.floor(unit.pos.y);

  const claimedTargets = state.units
    .filter((u) => u.id !== unit.id && u.explorationTarget)
    .map((u) => u.explorationTarget!);

  const otherUnitPositions = state.units
    .filter(
      (u) =>
        u.id !== unit.id &&
        u.hp > 0 &&
        u.state !== UnitState.Extracted &&
        u.state !== UnitState.Dead,
    )
    .map((u) => u.pos);

  const mapDim = Math.max(state.map.width, state.map.height);
  const avoidRadius = Math.max(3.0, Math.min(5, mapDim / 4));
  const unitAvoidRadius = Math.max(1.5, Math.min(3, mapDim / 6));

  const queue: { x: number; y: number }[] = [{ x: startX, y: startY }];
  const visited = new Set<string>();
  visited.add(`${startX},${startY}`);

  let fallbackCell: Vector2 | null = null;
  let head = 0;

  while (head < queue.length) {
    const curr = queue[head++];

    if (!isCellDiscovered(state, curr.x, curr.y)) {
      const target = { x: curr.x + 0.5, y: curr.y + 0.5 };
      const isClaimed = claimedTargets.some(
        (claimed) => getDistance(target, claimed) < avoidRadius,
      );
      const tooCloseToUnit = otherUnitPositions.some(
        (pos) => getDistance(target, pos) < unitAvoidRadius,
      );

      if (!isClaimed && !tooCloseToUnit) {
        return { x: curr.x, y: curr.y };
      }

      if (!fallbackCell) {
        fallbackCell = { x: curr.x, y: curr.y };
      }
    }

    const neighbors = [
      { x: curr.x + 1, y: curr.y },
      { x: curr.x - 1, y: curr.y },
      { x: curr.x, y: curr.y + 1 },
      { x: curr.x, y: curr.y - 1 },
    ];

    for (const n of neighbors) {
      if (
        n.x >= 0 &&
        n.x < state.map.width &&
        n.y >= 0 &&
        n.y < state.map.height
      ) {
        const nKey = `${n.x},${n.y}`;
        if (!visited.has(nKey) && gameGrid.isWalkable(n.x, n.y)) {
          if (gameGrid.canMove(curr.x, curr.y, n.x, n.y, doors, true)) {
            visited.add(nKey);
            queue.push({ x: n.x, y: n.y });
          }
        }
      }
    }
  }

  return fallbackCell;
}
