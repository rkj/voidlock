import { GameState, Unit, Door } from "../../../shared/types";
import { AIContext } from "../../managers/UnitAI";
import { PRNG } from "../../../shared/PRNG";
import { IDirector } from "../../interfaces/IDirector";

export interface Behavior {
  evaluate(
    unit: Unit,
    state: GameState,
    dt: number,
    doors: Map<string, Door>,
    prng: PRNG,
    context: AIContext,
    director?: IDirector,
  ): boolean;
}
