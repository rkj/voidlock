import type { GameState, Unit, Door } from "../../../shared/types";
import { UnitState } from "../../../shared/types";
import type { BehaviorContext } from "../../interfaces/AIContext";
import type { PRNG } from "../../../shared/PRNG";
import type { Behavior, BehaviorResult } from "./Behavior";
import type { LineOfSight } from "../../LineOfSight";
import type { VipAI } from "../VipAI";
import type { ItemEffectHandler } from "../../interfaces/IDirector";
import { MathUtils } from "../../../shared/utils/MathUtils";

export class VipBehavior implements Behavior<BehaviorContext> {
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
    context: BehaviorContext,
    director?: ItemEffectHandler,
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
