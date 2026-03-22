import type { CommandType, Unit } from "@src/shared/types";
import type { CommandExecParams } from "./IUnitCommandHandler";
import type { IUnitCommandHandler } from "./IUnitCommandHandler";

/** Params for registry.execute — registry is injected automatically */
export type RegistryExecParams = Omit<CommandExecParams, "registry">;

export class UnitCommandRegistry {
  private handlers: Map<CommandType, IUnitCommandHandler> = new Map();

  public register(handler: IUnitCommandHandler): void {
    this.handlers.set(handler.type, handler);
  }

  public execute(params: RegistryExecParams): Unit {
    const handler = this.handlers.get(params.cmd.type);
    if (handler) {
      return handler.execute({ ...params, registry: this });
    }
    return params.unit;
  }
}
