import { GameState } from "@src/shared/types";

export interface RenderLayer {
  draw(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    deltaTime: number,
  ): void;
  destroy?(): void;
}
