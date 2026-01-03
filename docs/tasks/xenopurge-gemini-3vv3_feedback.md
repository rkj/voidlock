# Verification Feedback: xenopurge-gemini-3vv3

## Build Failure
The project failed to build with the following TypeScript errors in `src/engine/managers/UnitManager.ts`:

```
src/engine/managers/UnitManager.ts:1012:46 - error TS18048: 'targetEnemy' is possibly 'undefined'.
1012         if (this.los.hasLineOfFire(unit.pos, targetEnemy.pos)) {
                                                  ~~~~~~~~~~~

src/engine/managers/UnitManager.ts:1017:57 - error TS18048: 'targetEnemy' is possibly 'undefined'.
1017             const distance = this.getDistance(unit.pos, targetEnemy.pos);
                                                             ~~~~~~~~~~~

src/engine/managers/UnitManager.ts:1024:15 - error TS18048: 'targetEnemy' is possibly 'undefined'.
1024               targetEnemy.hp -= unit.stats.damage;
                   ~~~~~~~~~~~

src/engine/managers/UnitManager.ts:1025:19 - error TS18048: 'targetEnemy' is possibly 'undefined'.
1025               if (targetEnemy.hp <= 0) {
                       ~~~~~~~~~~~

src/engine/managers/UnitManager.ts:1032:42 - error TS18048: 'targetEnemy' is possibly 'undefined'.
1032             unit.lastAttackTarget = { ...targetEnemy.pos };
                                              ~~~~~~~~~~~
```

## Instructions
Please fix these TypeScript errors. You should ensure that `targetEnemy` is recognized as defined within the attack block. You might need to change the condition to `if (unit.archetypeId !== "vip" && targetEnemy && (policy === "ENGAGE" || isLockedInMelee))` or use a type guard.

After fixing, ensure `npm run build` passes.
