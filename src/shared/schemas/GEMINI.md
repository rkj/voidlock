# src/shared/schemas

This directory contains Zod schemas for runtime validation of shared data structures.

## Files

- `index.ts`: Barrel file exporting all schemas.
- `common.ts`: Shared geometric schemas like `Vector2Schema`.
- `map.ts`: Schemas for map definitions (`MapDefinitionSchema`).
- `campaign.ts`: Schemas for campaign state and related entities (`CampaignStateSchema`).
- `units.ts`: Schemas for unit and squad configurations (`SquadConfigSchema`).
- `config.ts`: Schemas for game and global configuration (`GameConfigSchema`).

## Usage

These schemas are used at system boundaries (LocalStorage load, user file uploads) to ensure data integrity and provide helpful error messages.

```typescript
import { CampaignStateSchema } from "@src/shared/schemas";

const result = CampaignStateSchema.safeParse(data);
if (result.success) {
  const state = result.data; // Fully typed
} else {
  console.error(result.error.format());
}
```

## Related ADRs

- [ADR 0033: Zod Runtime Schema Validation](../../docs/adr/0033-zod-runtime-validation.md)
