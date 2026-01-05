The screen transition state machine is blocking valid gameplay flows.
Error seen in console: "[error] Invalid screen transition: equipment -> mission"

When starting a Custom Mission, the flow is:
`mission-setup` -> `equipment` -> `mission`.

Please update `VALID_TRANSITIONS` in `src/renderer/ScreenTransitions.ts` to allow `mission` as a destination for `equipment`.

Also, double check if other transitions are missing (e.g. `debrief -> main-menu`? Actually that was already there).

Current `VALID_TRANSITIONS` for reference:
```typescript
export const VALID_TRANSITIONS: Record<ScreenId, ScreenId[]> = {
  "main-menu": ["campaign", "mission-setup"],
  "campaign": ["main-menu", "barracks", "equipment", "mission"],
  "mission-setup": ["main-menu", "equipment", "mission"],
  "equipment": ["campaign", "mission-setup"], // MISSING "mission"
  "barracks": ["campaign"],
  "mission": ["main-menu", "campaign", "debrief"],
  "debrief": ["main-menu", "campaign"]
};
```
