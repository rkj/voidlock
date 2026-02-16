import {
  GameState,
  Unit,
  Command,
  Vector2,
} from "../../shared/types";
import { ItemEffectHandler } from "./IDirector";
import { SpatialGrid } from "../../shared/utils/SpatialGrid";

export interface VisibleItem {
  id: string;
  pos: Vector2;
  mustBeInLOS: boolean;
  visible?: boolean;
  type: "loot" | "objective";
}

export interface BehaviorContext {
  agentControlEnabled: boolean;
  executeCommand: (
    unit: Unit,
    cmd: Command,
    state: GameState,
    isManual: boolean,
    director?: ItemEffectHandler,
  ) => Unit;
}

export interface ObjectiveContext {
  claimedObjectives: Map<string, string>; // objectiveId -> unitId
  itemAssignments: Map<string, string>;
  itemGrid?: SpatialGrid<VisibleItem>;
}

export interface ExplorationContext {
  totalFloorCells: number;
  gridState?: Uint8Array;
  explorationClaims: Map<string, Vector2>; // unitId -> targetCell
}

export interface AIContext extends BehaviorContext, ObjectiveContext, ExplorationContext {}
