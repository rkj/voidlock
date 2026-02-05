import { z } from "zod";
import { Vector2Schema, WallDefinitionSchema } from "./common";

export const CellTypeSchema = z.enum(["Void", "Floor"]);

export const CellSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  type: CellTypeSchema,
  roomId: z.string().optional(),
});

export const BoundaryTypeSchema = z.enum(["Open", "Wall", "Door"]);

export const BoundaryDefinitionSchema = z.object({
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
  type: BoundaryTypeSchema,
  doorId: z.string().optional(),
});

export const DoorStateSchema = z.enum([
  "Open",
  "Closed",
  "Locked",
  "Destroyed",
]);

export const DoorSchema = z.object({
  id: z.string(),
  segment: z.array(Vector2Schema),
  orientation: z.enum(["Horizontal", "Vertical"]),
  state: DoorStateSchema,
  hp: z.number(),
  maxHp: z.number(),
  openDuration: z.number(),
  openTimer: z.number().optional(),
  targetState: z.enum(["Open", "Closed", "Locked"]).optional(),
});

export const SpawnPointSchema = z.object({
  id: z.string(),
  pos: Vector2Schema,
  radius: z.number(),
});

export const ObjectiveKindSchema = z.enum(["Recover", "Kill", "Escort"]);

export const ObjectiveDefinitionSchema = z.object({
  id: z.string(),
  kind: ObjectiveKindSchema,
  targetCell: Vector2Schema.optional(),
  targetEnemyId: z.string().optional(),
});

export const MapDefinitionSchema = z.object({
  width: z.number().int().min(6).max(100), // Adjusted min to 6 based on code references
  height: z.number().int().min(6).max(100),
  generatorName: z.string().optional(),
  cells: z.array(CellSchema),
  walls: z.array(WallDefinitionSchema).optional(),
  boundaries: z.array(BoundaryDefinitionSchema).optional(),
  doors: z.array(DoorSchema).optional(),
  spawnPoints: z.array(SpawnPointSchema).optional(),
  squadSpawn: Vector2Schema.optional(),
  squadSpawns: z.array(Vector2Schema).optional(),
  extraction: Vector2Schema.optional(),
  objectives: z.array(ObjectiveDefinitionSchema).optional(),
  bonusLoot: z.array(Vector2Schema).optional(),
});

export type MapDefinition = z.infer<typeof MapDefinitionSchema>;
