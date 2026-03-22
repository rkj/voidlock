import type {
  Unit,
  Command,
  GameState} from "../../shared/types";
import {
  CommandType
} from "../../shared/types";
import type { Pathfinder } from "../Pathfinder";
import type { ItemEffectHandler } from "../interfaces/IDirector";
import { UnitCommandRegistry } from "./commands/UnitCommandRegistry";
import { MoveToHandler } from "./commands/handlers/MoveToHandler";
import { EscortUnitHandler } from "./commands/handlers/EscortUnitHandler";
import { OverwatchPointHandler } from "./commands/handlers/OverwatchPointHandler";
import { ExploreHandler } from "./commands/handlers/ExploreHandler";
import { SetEngagementHandler } from "./commands/handlers/SetEngagementHandler";
import { StopHandler } from "./commands/handlers/StopHandler";
import { ResumeAiHandler } from "./commands/handlers/ResumeAiHandler";
import { PickupHandler } from "./commands/handlers/PickupHandler";
import { ExtractHandler } from "./commands/handlers/ExtractHandler";
import { UseItemHandler } from "./commands/handlers/UseItemHandler";

export interface ExecuteCommandParams {
  unit: Unit;
  cmd: Command;
  state: GameState;
  isManual?: boolean;
  director?: ItemEffectHandler;
}

export class CommandExecutor {
  private registry: UnitCommandRegistry;

  constructor(pathfinder: Pathfinder) {
    this.registry = new UnitCommandRegistry();
    this.registry.register(new MoveToHandler(pathfinder));
    this.registry.register(new EscortUnitHandler());
    this.registry.register(new OverwatchPointHandler());
    this.registry.register(new ExploreHandler());
    this.registry.register(new SetEngagementHandler());
    this.registry.register(new StopHandler());
    this.registry.register(new ResumeAiHandler());
    this.registry.register(new PickupHandler());
    this.registry.register(new ExtractHandler());
    this.registry.register(new UseItemHandler());
  }

  public executeCommand({
    unit,
    cmd,
    state,
    isManual = true,
    director,
  }: ExecuteCommandParams): Unit {
    const currentUnit: Unit = { ...unit, activeCommand: cmd };

    if (isManual) {
      currentUnit.activePlan = undefined;
      currentUnit.explorationTarget = undefined;
    }

    if (
      isManual &&
      cmd.type !== CommandType.EXPLORE &&
      cmd.type !== CommandType.RESUME_AI
    ) {
      // If we are issuing a manual PICKUP or USE_ITEM command while AI is enabled,
      // we want to resume AI after the action is complete.
      if (
        currentUnit.aiEnabled &&
        (cmd.type === CommandType.PICKUP || cmd.type === CommandType.USE_ITEM)
      ) {
        currentUnit.commandQueue = currentUnit.commandQueue.concat({
          type: CommandType.RESUME_AI,
          unitIds: [currentUnit.id],
        });
      }
      currentUnit.aiEnabled = false;
    }

    return this.registry.execute({ unit: currentUnit, cmd, state, isManual, director });
  }
}
