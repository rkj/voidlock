import type { GameState, Unit, Door } from "../../../shared/types";
import type { BehaviorContext } from "../../interfaces/AIContext";
import type { PRNG } from "../../../shared/PRNG";
import type { ItemEffectHandler } from "../../interfaces/IDirector";

export interface BehaviorResult {
  unit: Unit;
  handled: boolean;
}

export interface Behavior<TContext extends BehaviorContext = BehaviorContext> {
  evaluate(
    unit: Unit,
    state: GameState,
    dt: number,
    doors: Map<string, Door>,
    prng: PRNG,
    context: TContext,
    director?: ItemEffectHandler,
  ): BehaviorResult;
}
