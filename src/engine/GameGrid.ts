import {
  MapDefinition,
  CellType,
  Grid,
  Door,
  BoundaryType,
} from "../shared/types";
import { Graph } from "./Graph";
import { MathUtils } from "../shared/utils/MathUtils";

export class GameGrid implements Grid {
  private graph: Graph;

  constructor(map: MapDefinition) {
    this.graph = new Graph(map);
  }

  public get width(): number {
    return this.graph.width;
  }

  public get height(): number {
    return this.graph.height;
  }

  public getGraph(): Graph {
    return this.graph;
  }

  isWalkable(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false;
    }
    return this.graph.cells[y][x].type === CellType.Floor;
  }

  canMove(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    doors?: Map<string, Door>,
    allowClosedDoors: boolean = false,
  ): boolean {
    if (!this.isWalkable(fromX, fromY) || !this.isWalkable(toX, toY)) {
      return false;
    }

    // Must be adjacent
    if (MathUtils.getManhattanDistance({ x: fromX, y: fromY }, { x: toX, y: toY }) !== 1) {
      return false;
    }

    const boundary = this.graph.getBoundary(fromX, fromY, toX, toY);
    if (!boundary) {
      return false;
    }

    if (boundary.doorId && doors) {
      const door = doors.get(boundary.doorId);
      if (door) {
        if (allowClosedDoors) {
          // Pathfinding treats Closed, Open, and Destroyed doors as passable.
          // Locked doors should still block pathfinding.
          return door.state !== "Locked";
        }
        // Allow movement if door is Open or Destroyed
        return door.state === "Open" || door.state === "Destroyed";
      }
    }

    return boundary.type === BoundaryType.Open;
  }
}
