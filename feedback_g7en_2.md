The implementation introduced several TypeScript errors that must be fixed. `npx tsc --noEmit` fails with 7 errors.

1. **Incorrect `CoreEngine` constructor call in `src/engine/tests/Exploration.test.ts:141`**:
   You passed `false` where a `MissionType` was expected.

   ```typescript
   const engine = new CoreEngine(
     map,
     1,
     { soldiers: [{ archetypeId: "assault" }], inventory: {} },
     true,
     false,
     false, // ERROR: missionType expected
     MissionType.Default,
   );
   ```

1. **`boundaries` property missing from `MapDefinition`**:
   You added `boundaries: []` to several `MapDefinition` mocks and tried to use `gameState.map.boundaries` in `MenuController.ts`, but `boundaries` is NOT defined in the `MapDefinition` type in `src/shared/types.ts`.

   If you need `boundaries` to find intersections in `MenuController.ts`, you MUST add it to the `MapDefinition` interface in `src/shared/types.ts`. However, consider if `MapDefinition` should really have this or if it's derived data. If it's required for the UI to show overwatch points, adding it to the shared type is acceptable.

1. **Implicit `any` types in `src/renderer/MenuController.ts:472, 477`**:
   Fix the `(b) =>` parameters to have proper types.

Please fix all TypeScript errors and ensure `npx tsc --noEmit` and all tests pass.
