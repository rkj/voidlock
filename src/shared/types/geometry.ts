export type Vector2 = { x: number; y: number };

export type WallDefinition = {
  p1: Vector2;
  p2: Vector2;
};

/**
 * Geometric rectangle definition.
 */
export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};
