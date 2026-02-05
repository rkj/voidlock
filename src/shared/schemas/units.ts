import { z } from "zod";

export const SquadSoldierConfigSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  tacticalNumber: z.number().optional(),
  archetypeId: z.string(),
  rightHand: z.string().optional(),
  leftHand: z.string().optional(),
  body: z.string().optional(),
  feet: z.string().optional(),
  hp: z.number().optional(),
  maxHp: z.number().optional(),
  soldierAim: z.number().optional(),
});

export const SquadConfigSchema = z.object({
  soldiers: z.array(SquadSoldierConfigSchema),
  inventory: z.record(z.string(), z.number()),
});
