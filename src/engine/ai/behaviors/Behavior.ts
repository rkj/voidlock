import type { GameState, Unit, Door } from "../../../shared/types";
import type { BehaviorContext } from "../../interfaces/AIContext";
import type { PRNG } from "../../../shared/PRNG";
import type { ItemEffectHandler } from "../../interfaces/IDirector";

export interface BehaviorResult {
  unit: Unit;
  handled: boolean;
}

export interface BehaviorEvalParams<TContext extends BehaviorContext = BehaviorContext> {
  unit: Unit;
  state: GameState;
  dt: number;
  doors: Map<string, Door>;
  prng: PRNG;
  context: TContext;
  director?: ItemEffectHandler;
}

export interface Behavior<TContext extends BehaviorContext = BehaviorContext> {
  evaluate(params: BehaviorEvalParams<TContext>): BehaviorResult;
}
