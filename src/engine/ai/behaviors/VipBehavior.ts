import {
  GameState,
  Unit,
  UnitState,
} from "../../../shared/types";
import { AIContext } from "../../managers/UnitAI";
import { PRNG } from "../../../shared/PRNG";
import { Behavior } from "./Behavior";
import { getDistance } from "./BehaviorUtils";
import { LineOfSight } from "../../LineOfSight";
import { VipAI } from "../VipAI";

export class VipBehavior implements Behavior {
  constructor(private vipAi: VipAI, private los: LineOfSight) {}

  public evaluate(
    unit: Unit,
    state: GameState,
    _dt: number,
    _doors: Map<string, any>,
    _prng: PRNG,
    context: AIContext,
    director?: any
  ): boolean {
    if (unit.archetypeId !== "vip") return false;

    if (!unit.aiEnabled) {
      const rescueSoldier = state.units.find(
        (u) =>
          u.id !== unit.id &&
          u.archetypeId !== "vip" &&
          u.hp > 0 &&
          (getDistance(unit.pos, u.pos) <= 1.5 ||
            this.los.hasLineOfSight(u.pos, unit.pos))
      );
      if (rescueSoldier) {
        unit.aiEnabled = true;
      }
    }

    if (
      unit.aiEnabled &&
      unit.state === UnitState.Idle &&
      unit.commandQueue.length === 0
    ) {
      const vipCommand = this.vipAi.think(unit, state);
      if (vipCommand) {
        context.executeCommand(unit, vipCommand, state, false, director);
        return true;
      }
    }

    return !unit.aiEnabled; // If not rescued, we consider it "handled" (no other logic should run)
  }
}
