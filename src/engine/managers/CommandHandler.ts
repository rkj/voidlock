import { GameState, Command, CommandType } from "../../shared/types";
import { UnitManager } from "./UnitManager";
import { IDirector } from "../interfaces/IDirector";
import { GlobalCommandRegistry } from "./commands/GlobalCommandRegistry";
import { DeployUnitHandler } from "./commands/handlers/global/DeployUnitHandler";
import { UndeployUnitHandler } from "./commands/handlers/global/UndeployUnitHandler";
import { StartMissionHandler } from "./commands/handlers/global/StartMissionHandler";
import { GlobalUseItemHandler } from "./commands/handlers/global/GlobalUseItemHandler";
import { ToggleDebugOverlayHandler } from "./commands/handlers/global/ToggleDebugOverlayHandler";
import { ToggleLosOverlayHandler } from "./commands/handlers/global/ToggleLosOverlayHandler";
import { DebugForceWinHandler } from "./commands/handlers/global/DebugForceWinHandler";
import { DebugForceLoseHandler } from "./commands/handlers/global/DebugForceLoseHandler";
import { UnitCommandApplier } from "./commands/handlers/global/UnitCommandApplier";

export class CommandHandler {
  private registry: GlobalCommandRegistry;

  constructor(unitManager: UnitManager, director: IDirector) {
    this.registry = new GlobalCommandRegistry();

    // Deployment commands
    this.registry.register(new DeployUnitHandler());
    this.registry.register(new UndeployUnitHandler());
    this.registry.register(new StartMissionHandler(unitManager));

    // Global & Item commands
    this.registry.register(new GlobalUseItemHandler(director, unitManager));
    this.registry.register(new ToggleDebugOverlayHandler());
    this.registry.register(new ToggleLosOverlayHandler());
    this.registry.register(new DebugForceWinHandler());
    this.registry.register(new DebugForceLoseHandler());

    // Unit commands
    const unitCommands = [
      CommandType.MOVE_TO,
      CommandType.SET_ENGAGEMENT,
      CommandType.STOP,
      CommandType.RESUME_AI,
      CommandType.OVERWATCH_POINT,
      CommandType.EXPLORE,
      CommandType.PICKUP,
      CommandType.ESCORT_UNIT,
      CommandType.EXTRACT,
    ];

    for (const type of unitCommands) {
      this.registry.register(
        new UnitCommandApplier(type, unitManager, director),
      );
    }
  }

  public applyCommand(state: GameState, cmd: Command) {
    if (state.status !== "Playing" && state.status !== "Deployment") return;

    if (state.status === "Deployment") {
      if (
        cmd.type === CommandType.DEPLOY_UNIT ||
        cmd.type === CommandType.UNDEPLOY_UNIT ||
        cmd.type === CommandType.START_MISSION
      ) {
        this.registry.handle(state, cmd);
        return;
      }
    }

    this.registry.handle(state, cmd);
  }
}
