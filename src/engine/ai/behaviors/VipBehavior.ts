import { GameState, Unit, UnitState, Door } from "../../../shared/types";
import { AIContext } from "../../managers/UnitAI";
import { PRNG } from "../../../shared/PRNG";
import { Behavior } from "./Behavior";
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
  ): boolean {
    if (unit.archetypeId !== "vip") return false;

    if (!unit.aiEnabled) {
      const rescueSoldier = state.units.find(
        (u) => {
          if (u.id === unit.id || u.archetypeId === "vip" || u.hp <= 0) return false;
          const dist = MathUtils.getDistance(unit.pos, u.pos);
          const hasLos = this.los.hasLineOfSight(u.pos, unit.pos);
          return dist <= 1.5 || hasLos;
        }
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
