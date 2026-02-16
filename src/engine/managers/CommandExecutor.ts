import {
  Unit,
  Command,
  CommandType,
  GameState,
} from "../../shared/types";
import { Pathfinder } from "../Pathfinder";
import { IDirector } from "../interfaces/IDirector";
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

  public executeCommand(
    unit: Unit,
    cmd: Command,
    state: GameState,
    isManual: boolean = true,
    director?: IDirector,
  ): Unit {
    let currentUnit: Unit = { ...unit, activeCommand: cmd };

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

    return this.registry.execute(currentUnit, cmd, state, isManual, director);
  }
}
