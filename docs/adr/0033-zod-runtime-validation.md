# ADR 0033: Zod Runtime Schema Validation

**Date:** 2026-02-04
**Status:** Proposed

## Context

The codebase currently has several locations where external data is parsed without proper schema validation:

1. **Campaign Save/Load** (`CampaignManager.ts`) - LocalStorage data parsed with basic type checks
2. **Uploaded Maps** (`GameApp.ts`) - User-provided JSON parsed with only try/catch
3. **Mission Config** - Configuration objects passed between modules without validation
4. **Future Cloud Sync** - Will require robust validation of server responses

Current approach uses manual type guards and `any`/`unknown` with ad-hoc validation:

```typescript
// Current pattern - verbose and error-prone
private validateState(data: unknown): CampaignState | null {
  if (typeof data !== 'object' || data === null) return null;
  const candidate = data as Record<string, unknown>;
  if (typeof candidate.version !== 'string') return null;
  if (typeof candidate.seed !== 'number') return null;
  // ... 20+ more checks
}
```

This pattern is:

- **Verbose**: Each field requires manual checking
- **Incomplete**: Easy to miss fields or nested validation
- **Not Type-Safe**: Manual casting loses TypeScript guarantees
- **Hard to Maintain**: Schema changes require updating validation logic separately from types

## Decision

We will integrate **Zod** for runtime schema validation at system boundaries.

### Why Zod

| Library | Bundle Size | TypeScript Integration   | API Style   |
| ------- | ----------- | ------------------------ | ----------- |
| Zod     | ~12KB       | Excellent (infers types) | Declarative |
| Yup     | ~15KB       | Good (separate types)    | Declarative |
| io-ts   | ~8KB        | Excellent                | Functional  |
| ajv     | ~30KB       | Requires codegen         | JSON Schema |

Zod was selected because:

1. **Type Inference**: Schema defines both runtime validation AND TypeScript type
2. **Small Bundle**: ~12KB gzipped, acceptable for game project
3. **Declarative API**: Readable, matches our codebase style
4. **No Codegen**: Works at runtime without build step
5. **Ecosystem**: Well-maintained, good documentation

### Implementation Plan

#### Phase 1: Core Schemas

Create `src/shared/schemas/` directory:

```typescript
// src/shared/schemas/campaign.ts
import { z } from "zod";

export const SoldierSchema = z.object({
  id: z.string(),
  name: z.string(),
  archetype: z.enum(["assault", "medic", "scout", "heavy"]),
  hp: z.number().min(0),
  maxHp: z.number().positive(),
  xp: z.number().min(0),
  level: z.number().min(1),
  equipment: z.object({
    leftHand: z.string().nullable(),
    rightHand: z.string().nullable(),
    armor: z.string().nullable(),
    consumables: z.array(z.string()),
  }),
});

export const CampaignStateSchema = z.object({
  version: z.string(),
  seed: z.number(),
  name: z.string(),
  difficulty: z.enum(["simulation", "clone", "iron", "hardcore"]),
  roster: z.array(SoldierSchema),
  scrap: z.number().min(0),
  intel: z.number().min(0),
  currentSector: z.number().min(0),
  completedMissions: z.array(z.string()),
  unlockedArchetypes: z.array(z.string()),
});

// Infer TypeScript type from schema
export type CampaignState = z.infer<typeof CampaignStateSchema>;
```

```typescript
// src/shared/schemas/map.ts
import { z } from "zod";

export const Vector2Schema = z.object({
  x: z.number(),
  y: z.number(),
});

export const CellSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  type: z.enum(["floor", "wall", "void"]),
  room: z.string().optional(),
});

export const MapDefinitionSchema = z.object({
  width: z.number().int().min(10).max(100),
  height: z.number().int().min(10).max(100),
  cells: z.array(CellSchema),
  spawnPoints: z.array(Vector2Schema),
  objectives: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        pos: Vector2Schema,
      }),
    )
    .optional(),
  doors: z
    .array(
      z.object({
        id: z.string(),
        pos: Vector2Schema,
        state: z.enum(["open", "closed", "locked"]),
      }),
    )
    .optional(),
});

export type MapDefinition = z.infer<typeof MapDefinitionSchema>;
```

#### Phase 2: Integration Points

**Campaign Save/Load:**

```typescript
// src/engine/campaign/CampaignManager.ts
import { CampaignStateSchema } from '@src/shared/schemas/campaign';

public load(): CampaignState | null {
  const raw = this.storage.load(STORAGE_KEY);
  const result = CampaignStateSchema.safeParse(raw);

  if (!result.success) {
    console.error('Invalid campaign data:', result.error.format());
    return null;
  }

  return result.data;
}
```

**Map Upload:**

```typescript
// src/renderer/app/GameApp.ts
import { MapDefinitionSchema } from "@src/shared/schemas/map";

onLoadStaticMap: async (json: string) => {
  try {
    const parsed = JSON.parse(json);
    const result = MapDefinitionSchema.safeParse(parsed);

    if (!result.success) {
      const errors = result.error.issues.map((i) => i.message).join(", ");
      await this.context.modalService.alert(`Invalid map: ${errors}`);
      return;
    }

    this.currentStaticMapData = MapUtility.transformMapData(result.data);
    await this.context.modalService.alert("Static Map Loaded.");
  } catch (e) {
    await this.context.modalService.alert("Invalid JSON format.");
  }
};
```

#### Phase 3: Migration Strategy

1. **Add Zod dependency**: `npm install zod`
2. **Create schemas** alongside existing types (don't replace yet)
3. **Add validation** at boundaries (load/save, user input)
4. **Gradually migrate** types to be inferred from schemas
5. **Remove manual validation** code as schemas cover those cases

### What NOT to Validate

- Internal function calls between trusted modules
- Engine state during simulation (trust internal consistency)
- Renderer-to-renderer communication

Validation should only occur at **system boundaries**:

- LocalStorage load
- User file uploads
- Future: API responses from cloud sync

## Consequences

### Positive

- **Type Safety**: Single source of truth for types and validation
- **Better Errors**: Zod provides detailed error messages with paths
- **Maintainability**: Schema changes automatically update both types and validation
- **Future-Proof**: Foundation for cloud sync validation

### Negative

- **Bundle Size**: +12KB gzipped
- **Learning Curve**: Team needs to learn Zod API
- **Migration Effort**: Existing manual validators need replacement

### Neutral

- **Performance**: Validation adds negligible overhead at boundaries (not in hot paths)

## Alternatives Considered

1. **Keep Manual Validation**: Rejected - too verbose, error-prone
2. **JSON Schema + ajv**: Rejected - larger bundle, requires separate type definitions
3. **io-ts**: Rejected - functional style doesn't match codebase conventions
4. **TypeScript-only (compile time)**: Insufficient - doesn't validate runtime data

## References

- [Zod Documentation](https://zod.dev/)
- [Zod GitHub](https://github.com/colinhacks/zod)
- Related: ADR-0034 (Firebase Cloud Save) - will use these schemas
