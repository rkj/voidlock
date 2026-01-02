The implementation introduced a TypeScript error in `src/renderer/MenuController.ts`:
`src/renderer/MenuController.ts:211:53 - error TS2339: Property 'COLLECT' does not exist on type 'typeof CommandType'.`

In `getRenderableState`, you added:
```typescript
    if (this.menuState === 'TARGET_SELECT') {
      if (this.pendingAction === CommandType.MOVE_TO) {
        this.generateTargetOverlay('CELL', gameState);
      } else if (this.pendingAction === CommandType.COLLECT) {
        this.generateTargetOverlay('ITEM', gameState);
      }
    }
```

However, `COLLECT` is NOT a member of `CommandType`. Both `MOVE` and `COLLECT` use `CommandType.MOVE_TO`. You should distinguish them using `this.pendingLabel` (which is 'Collecting' for collect) or similar logic.

Please fix this type error and ensure `npx tsc --noEmit` passes.