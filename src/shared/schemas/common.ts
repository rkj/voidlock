import { z } from "zod";

export const Vector2Schema = z.object({
  x: z.number(),
  y: z.number(),
});

export const WallDefinitionSchema = z.object({
  p1: Vector2Schema,
  p2: Vector2Schema,
});
