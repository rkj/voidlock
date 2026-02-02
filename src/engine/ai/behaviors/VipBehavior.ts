import { GameState, Unit, UnitState, Door } from "../../../shared/types";
import { AIContext } from "../../managers/UnitAI";
import { PRNG } from "../../../shared/PRNG";
import { Behavior, BehaviorResult } from "./Behavior";
import { LineOfSight } from "../../LineOfSight";
import { VipAI } from "../VipAI";
import { IDirector } from "../../interfaces/IDirector";
import { MathUtils } from "../../../shared/utils/MathUtils";

export class VipBehavior implements Behavior {
  constructor(
    private vipAi: VipAI,
    private los: LineOfSight,
  ) {}

  public evaluate(
    unit: Unit,
    state: GameState,
    _dt: number,
    _doors: Map<string, Door>,
    _prng: PRNG,
    context: AIContext,
    director?: IDirector,
  ): BehaviorResult {
    let currentUnit = { ...unit };
    if (currentUnit.archetypeId !== "vip")
      return { unit: currentUnit, handled: false };

    if (!currentUnit.aiEnabled) {
      const rescueSoldier = state.units.find((u) => {
        if (u.id === currentUnit.id || u.archetypeId === "vip" || u.hp <= 0)
          return false;
        const dist = MathUtils.getDistance(currentUnit.pos, u.pos);
        const hasLos = this.los.hasLineOfSight(u.pos, currentUnit.pos);
        return dist <= 1.5 || hasLos;
      });
      if (rescueSoldier) {
        currentUnit = { ...currentUnit, aiEnabled: true };
      }
    }

    if (
      currentUnit.aiEnabled &&
      currentUnit.state === UnitState.Idle &&
      currentUnit.commandQueue.length === 0
    ) {
      const vipCommand = this.vipAi.think(currentUnit, state);
      if (vipCommand) {
        currentUnit = context.executeCommand(
          currentUnit,
          vipCommand,
          state,
          false,
          director,
        );
        return { unit: currentUnit, handled: true };
      }
    }

    return { unit: currentUnit, handled: !currentUnit.aiEnabled }; // If not rescued, we consider it "handled" (no other logic should run)
  }
}
