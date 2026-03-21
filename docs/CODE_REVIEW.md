# Voidlock — Code Review (Revised)

**Version:** 0.106.17
**Review Date:** February 2026
**Revision:** 2 — supersedes the initial review
**Status:** All issues from Review 1 remain open. New issues added.

---

## What Changed From the Previous Review

The previous review (Review 1) flagged 13 issues across type safety, performance,
duplication, and maintainability. All 13 remain unaddressed — the codebase is
unchanged since that review was written. This revision retains every open finding
from Review 1 and adds 18 new issues discovered during the follow-up pass,
including one determinism-breaking bug in `RosterManager`.

Issues are ordered by severity within each section.

---

## 1. Bugs

These are the highest priority items because they affect correctness at runtime.

---

### 1.1 `RosterManager` uses `Math.random()` and `Date.now()` — breaks deterministic replay

**Severity:** Critical
**File:** `src/engine/campaign/RosterManager.ts:61`

```typescript
id: `soldier_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
```

The entire engine is built around a seeded PRNG (`src/shared/PRNG.ts`) so that the
same seed + command log produces an identical simulation. `Math.random()` is unseeded
and `Date.now()` is wall-clock time. Neither is deterministic. Any code path that
exercises soldier recruitment will produce different IDs on replay, which silently
breaks the replay system.

Compare with `EventManager.ts:88`, which correctly uses `prng.next()` for the random
portion but still uses `Date.now()` for the timestamp portion:

```typescript
id: `soldier_${Date.now()}_${Math.floor(prng.next() * 1000)}`,
```

**Fix:** `RosterManager` needs access to a `PRNG` instance (or a monotonic counter
scoped to the campaign). Both soldier-ID generators should use `prng` exclusively.
`Date.now()` must be removed from both.

---

### 1.2 Grenades damage units with no liveness or extraction guard

**Severity:** High
**File:** `src/engine/Director.ts:139-150`

```typescript
state.enemies.forEach((e) => {
  if (Math.floor(e.pos.x) === targetX && Math.floor(e.pos.y) === targetY) {
    e.hp -= 100;                  // no state check
  }
});

state.units.forEach((u) => {
  if (Math.floor(u.pos.x) === targetX && Math.floor(u.pos.y) === targetY) {
    u.hp -= 100;                  // no state check, no friendly-fire flag
  }
});
```

Dead or already-extracted units in the blast cell have their HP decremented further.
Nothing prevents HP from going deeply negative on corpses, and nothing prevents
damage to units whose state is `Extracted`.

**Fix:** Guard both loops with a liveness check (`state !== "Dead"` and
`state !== "Extracted"`). If friendly fire is intentional, add a flag or log entry
so the behaviour is explicit.

---

### 1.3 `EnemyManager` compares unit state against bare string literals

**Severity:** Medium
**File:** `src/engine/managers/EnemyManager.ts:51-52, 59-60`

```typescript
unit.state !== "Extracted" &&
unit.state !== "Dead" &&
```

Every other file in the engine uses the `UnitState` enum. If the enum values change,
these string literals will silently become dead comparisons and the bug will not be
caught at compile time.

**Fix:** Import `UnitState` and use `UnitState.Extracted` / `UnitState.Dead`.

---

### 1.4 `MapFactory.fromAscii` has no bounds check on line access

**Severity:** Medium
**File:** `src/engine/map/MapFactory.ts:491`

```typescript
const char = lines[ey][ex];
```

If the input string has fewer lines than the declared height, or lines shorter than
the declared width, `lines[ey]` is `undefined` and `lines[ey][ex]` throws. No
validation is performed on line count or line length before the nested loop begins.

**Fix:** Validate `lines.length >= height` and every `lines[y].length >= width`
before parsing. Return an error or throw with a clear message on mismatch.

---

### 1.5 `realDt` parameter receives the same value as `dt` — name or value is wrong

**Severity:** Medium
**Files:** `src/engine/managers/UnitManager.ts:64` (declaration),
`src/engine/CoreEngine.ts:504` (call site)

The parameter is named `realDt`, implying unscaled wall-clock time. The call site
passes `scaledDt` — the same value used for `dt`:

```typescript
// CoreEngine.ts:504
this.unitManager.update(state, scaledDt, ..., this.director, scaledDt);
//                             ^^^^^^^^                        ^^^^^^^^
//                             dt                              realDt  (same value)
```

`realDt` is used at `UnitManager.ts:349` to tick channeling timers:
`unit.channeling.remaining -= realDt`. If channeling is meant to tick at real time,
the wrong value is being passed. If channeling is meant to tick at scaled time, the
parameter name is misleading.

**Fix:** Determine the intended behaviour. If real time is needed, pass the
unscaled delta. If scaled time is correct, rename the parameter to `channelDt` or
remove it entirely and use `dt`.

---

## 2. Type Safety

All items from Review 1 remain open. New items are added below.

---

### 2.1 `director?: any` propagated through 12 call sites

**Severity:** High

The `Director` class is fully typed. The parameter is typed as `any` in every
file that receives it:

| File | Line(s) |
|------|---------|
| `src/engine/ai/behaviors/Behavior.ts` | 13 |
| `src/engine/ai/behaviors/CombatBehavior.ts` | 24 |
| `src/engine/ai/behaviors/ExplorationBehavior.ts` | 28 |
| `src/engine/ai/behaviors/InteractionBehavior.ts` | 21 |
| `src/engine/ai/behaviors/ObjectiveBehavior.ts` | 22 |
| `src/engine/ai/behaviors/SafetyBehavior.ts` | 22 |
| `src/engine/ai/behaviors/VipBehavior.ts` | 23 |
| `src/engine/managers/UnitAI.ts` | 33, 66 |
| `src/engine/managers/UnitManager.ts` | 63, 487 |
| `src/engine/managers/CommandExecutor.ts` | 21 |

**Fix:** The correct entry point is the `Behavior` interface
(`src/engine/ai/behaviors/Behavior.ts:13`). Change `director?: any` to
`director?: Director` there. The rest of the chain follows.

---

### 2.2 EVENT payload in `gamestate.ts` is `any`

**Severity:** High
**File:** `src/shared/types/gamestate.ts:112`

```typescript
| { type: "EVENT"; payload: any };
```

**Fix:** Define a discriminated union for all event payload shapes and use it
in place of `any`.

---

### 2.3 `GameClient.saveMissionConfig` takes `any`

**Severity:** Medium
**File:** `src/engine/GameClient.ts:207`

```typescript
private saveMissionConfig(config: any) {
```

**Fix:** Define a `MissionConfig` interface and use it.

---

### 2.4 `GameClient.init` casts `nodeType` with `as any`

**Severity:** Medium
**File:** `src/engine/GameClient.ts:158`

```typescript
nodeType: nodeType as any,
```

The parameter is declared as `nodeType?: string` at line 86 with a comment
saying the string type is intentional. It is not — the downstream consumer
expects `CampaignNodeType`. Either widen the downstream type or narrow this
parameter.

---

### 2.5 `CampaignManager` load/validate chain uses `any` in six places

**Severity:** Medium
**File:** `src/engine/managers/CampaignManager.ts:269, 283, 308, 336, 340, 341`

`storage.load<any>`, `validateState(data: any)`, and every `.map`/`.filter`
callback in the validation body.

**Fix:** Use `unknown` for the loaded value. Write a type guard
(`data is CampaignState`) and let TypeScript narrow after the check.

---

### 2.6 `MenuController` constructor types the client callback as `any`

**Severity:** Medium
**File:** `src/renderer/MenuController.ts:113`

```typescript
constructor(private client: { sendCommand: (cmd: any) => void }) {}
```

**Fix:** `cmd` should be `Command`.

---

### 2.7 `CommandBuilder.build` returns `any`; intermediate object is `any`

**Severity:** Medium
**File:** `src/renderer/controllers/CommandBuilder.ts:17, 30`

**Fix:** Return type `Command | null`. Type `base` as `Partial<Command>` or
as the specific command shape for each branch.

---

### 2.8 `CoreEngine` uses `as Unit` assertions on object literals

**Severity:** Medium
**File:** `src/engine/CoreEngine.ts:219, 308`

```typescript
this.addUnit({ id: ..., pos: ..., ... } as Unit);
```

A missing required field will not be caught at compile time.

**Fix:** Remove the `as Unit` cast. If the literal is complete, no cast is needed.
If it is incomplete, the compile error will show exactly which field is missing.

---

### 2.9 `item: any` annotation in filter suppresses type checking

**Severity:** Low
**File:** `src/engine/managers/UnitManager.ts:255`

```typescript
].filter((item: any) => {
```

The array is already typed. The annotation is unnecessary and suppresses inference.

**Fix:** Remove `: any`.

---

### 2.10 `StorageProvider.save` parameter is `any`

**Severity:** Low
**File:** `src/engine/persistence/StorageProvider.ts:11`

```typescript
save(key: string, data: any): void;
```

`load` on the same interface already uses a generic. `save` should match:
`save<T>(key: string, data: T): void`.

---

### 2.11 `LocalStorageProvider.load` casts `JSON.parse` result with `as T`

**Severity:** Medium
**File:** `src/engine/persistence/LocalStorageProvider.ts:20`

```typescript
return JSON.parse(json) as T;
```

`JSON.parse` returns `any`. The `as T` assertion is a no-op at runtime.
This is partially mitigated by downstream validation in `CampaignManager`,
but `MetaManager` also calls `load` without the same validation depth.

**Fix:** Callers must validate. Consider returning `unknown` from `load`
and requiring callers to narrow.

---

## 3. Performance

---

### 3.1 `discoveredCells.includes()` — O(n) linear scan in hot loops

**Severity:** High
**Files:** `src/engine/Director.ts:168`, `src/engine/ai/VipAI.ts:61, 157`,
`src/engine/managers/MissionManager.ts:196, 204`,
`src/renderer/visuals/MapEntityLayer.ts:29, 55, 78`,
`src/renderer/visuals/MapLayer.ts:170`

`state.discoveredCells` is a `string[]`. Every `.includes()` call is O(n).
`Director.ts:168` calls it inside a nested loop that covers a radius-5 circle
(up to 81 iterations per frame).

`VisibilityManager` already converts `discoveredCells` to a `Set` each frame
for its own use, then converts it back to an array. The Set is not shared.

**Fix:** Produce the `Set<string>` once per frame (in `VisibilityManager` or
`CoreEngine`) and pass it to every consumer. Better yet, store `discoveredCells`
as a `Set<string>` in `GameState` directly and convert to an array only when
serialising for the main thread.

---

### 3.2 `.sort()` used to find a single min or max — O(n log n) instead of O(n)

**Severity:** Medium
**Files:**

| File | Line | What it finds |
|------|------|---------------|
| `src/engine/managers/UnitManager.ts` | 280 | Closest unit to item |
| `src/engine/ai/behaviors/SafetyBehavior.ts` | 108 | Closest ally |
| `src/engine/ai/VipAI.ts` | 172 | Best-scoring patrol point |
| `src/engine/ai/behaviors/CombatBehavior.ts` | 107 | Farthest enemy |

`.sort()` also mutates the source array in place. In every case above only
`[0]` is read after the sort. The rest of the sorted order is discarded.

**Fix:** Replace each with a single-pass `reduce`:

```typescript
const closest = units.reduce(
  (best, unit) =>
    getDistance(unit.pos, target) < getDistance(best.pos, target) ? unit : best,
  units[0],
);
```

---

### 3.3 `CoreEngine.getState()` deep-clones via `JSON.parse(JSON.stringify(...))`

**Severity:** Medium
**File:** `src/engine/CoreEngine.ts:352`

```typescript
public getState(): GameState {
  const copy = JSON.parse(JSON.stringify(this.state));
  copy.commandLog = [...this.commandLog];
  return copy;
}
```

Called every state-update cycle. JSON round-trip is the slowest general-purpose
deep-clone available in the browser.

**Fix (cheapest):** `structuredClone(this.state)` — native, faster than JSON
for objects without circular references, handles `Map`/`Set`/`Date` correctly.

**Fix (best):** If the renderer never mutates the state it receives, return
`this.state` directly and enforce read-only access on the main thread. The
worker already produces a new state object on every tick when managers mutate it.

---

## 4. Code Duplication

---

### 4.1 `getDistance` — 7 private copies, shared version already exists

**Severity:** Medium

`src/engine/ai/behaviors/BehaviorUtils.ts:4` already exports:

```typescript
export function getDistance(pos1: Vector2, pos2: Vector2): number {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  return Math.sqrt(dx * dx + dy * dy);
}
```

The behaviour files import and use it. The following classes each contain an
identical private copy that ignores the existing export:

| File | Line |
|------|------|
| `src/engine/managers/UnitManager.ts` | 492 |
| `src/engine/managers/CommandExecutor.ts` | 269 |
| `src/engine/managers/CombatManager.ts` | 177 |
| `src/engine/managers/EnemyManager.ts` | 151 |
| `src/engine/ai/EnemyAI.ts` | 105 |
| `src/engine/ai/RangedKiteAI.ts` | 177 |
| `src/engine/ai/VipAI.ts` | 112 |

`EnemyManager.ts:151` also uses an anonymous `{ x: number; y: number }` type
instead of `Vector2`, making it visually different from all others.

**Fix:** Delete all 7 private copies. Import `getDistance` from `BehaviorUtils`
(or move it to a more neutral shared location such as `shared/math.ts` and
update `BehaviorUtils` to re-export it).

---

### 4.2 `getBoundaryKey` — duplicated in 4 classes plus one inline closure

**Severity:** Low
**Files:**

| File | Line |
|------|------|
| `src/engine/Graph.ts` | 190 |
| `src/engine/generators/TreeShipGenerator.ts` | 41 |
| `src/engine/generators/DenseShipGenerator.ts` | 45 |
| `src/engine/generators/SpaceshipGenerator.ts` | 50 |
| `src/engine/map/MapFactory.ts` | 201 (inline arrow) |

All produce the same key: sort two `"x,y"` strings and join with `"--"`.

**Fix:** Extract to a shared utility and import in all five locations.

---

### 4.3 Node-advancement and soldier-recovery blocks duplicated in `MissionReconciler`

**Severity:** Medium
**File:** `src/engine/campaign/MissionReconciler.ts`

`processMissionResult` (lines 17–42) and `advanceCampaignWithoutMission`
(lines 145–168) contain the same four-step node-advancement sequence.
Both methods also contain the same soldier-recovery loop (lines 64–72
and 174–182).

**Fix:** Extract `advanceNode(state, node)` and `tickRecovery(state)` as
private helpers. Call them from both methods.

---

### 4.4 Hive-spawn block duplicated in `MissionManager.setupMission`

**Severity:** Medium
**File:** `src/engine/managers/MissionManager.ts:111-147` and `152-188`

Two blocks that each filter floor cells, pick a random spawn, create a
`Hive` enemy, and push a Kill objective. The enemy construction is
identical except for `hp`/`maxHp` and `difficulty`.

**Fix:** Extract `spawnHive(state, enemyManager, map, id, hp, difficulty)`
and call it from both branches.

---

### 4.5 `clone` and `default` cases in `getRulesForDifficulty` are identical

**Severity:** Low
**File:** `src/engine/managers/CampaignManager.ts:188-203` and `237-251`

Both return the exact same object. The `default` case is unreachable dead
code if every valid difficulty string is already handled above it.

**Fix:** Make `default` fall through to `"clone"`, or remove it if the
switch is exhaustive.

---

### 4.6 Soldier-creation template duplicated between `RosterManager` and `EventManager`

**Severity:** Low
**Files:** `src/engine/campaign/RosterManager.ts:22-41`,
`src/engine/campaign/EventManager.ts:87-106`

Both construct a `CampaignSoldier` with the same archetype-lookup pattern.

**Fix:** Extract a `createSoldier(archId, name, id, prng)` factory shared
by both.

---

### 4.7 `EPSILON` defined independently in two files

**Severity:** Low
**Files:** `src/engine/managers/UnitManager.ts:26`,
`src/engine/managers/EnemyManager.ts:15`

Both define `const EPSILON = 0.05`. `src/engine/Constants.ts` already exists.

**Fix:** Move `EPSILON` to `Constants.ts` and import it.

---

## 5. Architecture and Design

---

### 5.1 `GameClient.init()` takes 17 positional parameters

**Severity:** High
**File:** `src/engine/GameClient.ts:62-84`

```typescript
public init(
  seed: number,
  mapGeneratorType: MapGeneratorType,
  mapData?: MapDefinition,
  fogOfWarEnabled: boolean = true,
  debugOverlayEnabled: boolean = false,
  agentControlEnabled: boolean = true,
  squadConfig: SquadConfig = { soldiers: [], inventory: {} },
  missionType: MissionType = MissionType.Default,
  width: number = 16,
  height: number = 16,
  spawnPointCount: number = 3,
  losOverlayEnabled: boolean = false,
  startingThreatLevel: number = 0,
  initialTimeScale: number = 1.0,
  startPaused: boolean = false,
  allowTacticalPause: boolean = true,
  mode: EngineMode = EngineMode.Simulation,
  commandLog: CommandLogEntry[] = [],
  ...
)
```

Callers must match position exactly. Adding or reordering a parameter in the
middle silently breaks every call site that relies on positional defaults.

**Fix:** Replace with a single options object:

```typescript
interface GameClientInitOptions {
  seed: number;
  mapGeneratorType: MapGeneratorType;
  mapData?: MapDefinition;
  fogOfWarEnabled?: boolean;
  // ... rest with defaults
}

public init(options: GameClientInitOptions): void { ... }
```

---

### 5.2 `MenuController` — 10 getter/setter pairs that purely delegate

**Severity:** Medium
**File:** `src/renderer/MenuController.ts:43-111`

Every property on `MenuController` is a one-line forward to `this.selection`:

```typescript
public get pendingAction(): CommandType | null {
  return this.selection.pendingAction;
}
public set pendingAction(value: CommandType | null) {
  this.selection.pendingAction = value;
}
// ... 9 more
```

This is structural noise. External code could reference `SelectionManager`
directly, or `MenuController` should expose higher-level operations instead
of proxying raw state.

**Fix:** Either expose `SelectionManager` to the caller and remove the
delegating pairs, or replace the getters/setters with methods that
encapsulate the state transitions.

---

### 5.3 `CampaignManager.startNewCampaign` has a legacy boolean overload path

**Severity:** Medium
**File:** `src/engine/managers/CampaignManager.ts:101-145`

```typescript
overrides?: CampaignOverrides | boolean,
```

The method branches on `typeof overrides === "object"` vs the legacy boolean
path, which also accepts 4 additional trailing parameters. Both paths exist
simultaneously.

**Fix:** Remove the `boolean` branch entirely. Update all call sites to pass
a `CampaignOverrides` object.

---

### 5.4 `GameApp` is 1185 lines; `CoreEngine` is 553 lines

**Severity:** Medium

`GameApp` owns screen management, campaign flow, mission setup, event handling,
UI coordination, and settings. `CoreEngine` owns game state, initialisation,
command handling, and subsystem orchestration, including inline VIP-spawn and
soldier-spawn logic (lines 181–321).

**Fix:** See the extraction suggestions in Review 1 (CampaignFlowCoordinator,
MissionCoordinator, UnitSpawner). No new extraction targets are identified here;
the existing recommendations stand.

---

## 6. Maintainability

---

### 6.1 Magic numbers — 117 occurrences across engine code

**Severity:** Medium

Key locations unchanged from Review 1:

| File | Values |
|------|--------|
| `src/engine/Director.ts:18, 63, 101, 111, 139, 148, 154, 184` | 10000, 10, 50, 100, 5 |
| `src/engine/managers/MissionManager.ts:129, 139, 171, 241, 286` | 1000, 500, 75, 100 |
| `src/engine/campaign/MissionReconciler.ts:85, 88, 202` | 50, 10, 100 |

**Fix:** Centralise into a constants file (e.g. `src/engine/config/GameConstants.ts`).
Group by domain: rewards, costs, combat, director tuning.

---

### 6.2 Hardcoded version string and archetype list in `CampaignManager`

**Severity:** Low
**File:** `src/engine/managers/CampaignManager.ts:152`

```typescript
version: "0.106.17",
unlockedArchetypes: ["assault", "medic", "scout", "heavy"],
```

**Fix:** Import version from `package.json`. Define the archetype list as a
typed constant.

---

### 6.3 `EnemyType` enum values use three different conventions

**Severity:** Low
**File:** `src/shared/types/units.ts:162-173`

Kebab-case (`"Xeno-Mite"`), PascalCase (`"SwarmMelee"`), and snake_case
(`"alien_scout"`) coexist in the same enum.

**Fix:** Pick one convention and update all values and every reference.

---

### 6.4 Complex algorithms lack explanatory comments

**Severity:** Low
**Files:** `src/engine/managers/MissionManager.ts:76-109` (Fisher-Yates
shuffle + objective-count ternary), `src/engine/managers/UnitManager.ts:104-156`
(53-line escort formation assignment with no high-level comment).

**Fix:** Add a single comment before each block explaining what it does and
why, not how.

---

### 6.5 `Archetype.accuracy` field is marked DEPRECATED but still populated

**Severity:** Low
**File:** `src/shared/types/units.ts:80`

```typescript
accuracy: number; // Hit chance percentage at 5 tiles (DEPRECATED)
```

**Fix:** Determine whether any code path reads this field. If not, remove it
from the type and all archetype definitions.

---

### 6.6 Dead code: `CampaignManager.checkBankruptcy()` is never called

**Severity:** Low
**File:** `src/engine/managers/CampaignManager.ts:401-404`

The bankruptcy check is performed inside `MissionReconciler.processMissionResult`
directly. This private method is unreachable.

**Fix:** Delete it.

---

## 7. Error Handling

---

### 7.1 `GameShell` uses non-null assertions on `getElementById` without guards

**Severity:** Low
**File:** `src/renderer/GameShell.ts:10-13`

```typescript
this.headerTitle = document.getElementById("header-title")!;
this.headerControls = document.getElementById("header-controls")!;
this.mainContent = document.getElementById("main-content")!;
this.footer = document.getElementById("global-footer")!;
```

A missing element will not surface until first use, making the failure
location opaque.

**Fix:**

```typescript
private getRequiredElement(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Required element missing: #${id}`);
  return el;
}
```

---

### 7.2 `spendScrap` silently returns when state is null, throws when funds are low

**Severity:** Low
**File:** `src/engine/managers/CampaignManager.ts:479-486`

```typescript
if (!this.state) return;        // silent
if (this.state.scrap < amount) {
  throw new Error("...");       // loud
}
```

Also no guard against negative or `NaN` amounts.

**Fix:** Throw consistently. Guard `amount > 0 && isFinite(amount)`.

---

## 8. Input Validation

---

### 8.1 Map upload paths have no schema validation

**Severity:** Medium
**File:** `src/renderer/app/GameApp.ts:283-301`

Both `onLoadStaticMap` and `onUploadStaticMap` parse JSON and pass the result
directly to `MapUtility.transformMapData`. Syntactically valid JSON with the
wrong structure will either produce a silently broken `MapDefinition` or throw
a runtime error surfaced as a generic "Invalid JSON" message.

**Fix:** Validate the parsed object against the `MapDefinition` shape before
calling `transformMapData`. Check required fields (`width`, `height`, `cells`,
spawn/extraction points). Return a specific error message for each missing or
malformed field.

---

## 9. Testing Gaps

The following critical components have no dedicated unit tests:

| Component | What to test |
|-----------|--------------|
| `DoorManager` | Open/close/lock/destroy transitions, timer expiry, boundary updates |
| `Director` | Spawn-wave scaling formula, threat-level calculation, pre-spawn logic |
| `CombatManager` | Weapon auto-switching, accuracy formula `(S/100) * (R/distance)`, sticky target acquisition |
| `MissionReconciler` | XP calculation (`missionXp + survivalXp + killXp`), level-up stat boosts, bankruptcy detection |
| `EventManager` | Cost deduction, risk/damage calculation, reward application |
| `SectorMapGenerator` | DAG reachability (every node reachable from start), no orphan nodes |

The XP calculation and accuracy formula are pure math — they are the easiest to
unit-test and the easiest to get subtly wrong. Start there.

---

## Summary — All Open Issues

| # | Category | File | Line(s) | Severity | New? |
|---|----------|------|---------|----------|------|
| 1.1 | Bug | RosterManager.ts | 61 | Critical | Yes |
| 1.2 | Bug | Director.ts | 139-150 | High | Yes |
| 1.3 | Bug | EnemyManager.ts | 51, 59 | Medium | Yes |
| 1.4 | Bug | MapFactory.ts | 491 | Medium | Yes |
| 1.5 | Bug | UnitManager.ts / CoreEngine.ts | 64 / 504 | Medium | Yes |
| 2.1 | Type Safety | 12 files | various | High | Yes |
| 2.2 | Type Safety | gamestate.ts | 112 | High | No |
| 2.3 | Type Safety | GameClient.ts | 207 | Medium | No |
| 2.4 | Type Safety | GameClient.ts | 158 | Medium | No |
| 2.5 | Type Safety | CampaignManager.ts | 269,283,308,336,340,341 | Medium | No |
| 2.6 | Type Safety | MenuController.ts | 113 | Medium | No |
| 2.7 | Type Safety | CommandBuilder.ts | 17, 30 | Medium | No |
| 2.8 | Type Safety | CoreEngine.ts | 219, 308 | Medium | Yes |
| 2.9 | Type Safety | UnitManager.ts | 255 | Low | No |
| 2.10 | Type Safety | StorageProvider.ts | 11 | Low | No |
| 2.11 | Type Safety | LocalStorageProvider.ts | 20 | Medium | Yes |
| 3.1 | Performance | 8 files | various | High | Yes |
| 3.2 | Performance | 4 files | various | Medium | Yes |
| 3.3 | Performance | CoreEngine.ts | 352 | Medium | No |
| 4.1 | Duplication | 7 files | various | Medium | Yes |
| 4.2 | Duplication | 5 files | various | Low | Yes |
| 4.3 | Duplication | MissionReconciler.ts | 17-42, 145-168 | Medium | Yes |
| 4.4 | Duplication | MissionManager.ts | 111-147, 152-188 | Medium | Yes |
| 4.5 | Duplication | CampaignManager.ts | 188-203, 237-251 | Low | Yes |
| 4.6 | Duplication | RosterManager.ts / EventManager.ts | 22-41 / 87-106 | Low | Yes |
| 4.7 | Duplication | UnitManager.ts / EnemyManager.ts | 26 / 15 | Low | Yes |
| 5.1 | Architecture | GameClient.ts | 62-84 | High | Yes |
| 5.2 | Architecture | MenuController.ts | 43-111 | Medium | Yes |
| 5.3 | Architecture | CampaignManager.ts | 101-145 | Medium | Yes |
| 5.4 | Architecture | GameApp.ts / CoreEngine.ts | 1185 / 553 lines | Medium | No |
| 6.1 | Maintainability | 3 files | various | Medium | No |
| 6.2 | Maintainability | CampaignManager.ts | 152 | Low | No |
| 6.3 | Maintainability | units.ts | 162-173 | Low | No |
| 6.4 | Maintainability | MissionManager / UnitManager | 76-109 / 104-156 | Low | No |
| 6.5 | Maintainability | units.ts | 80 | Low | Yes |
| 6.6 | Maintainability | CampaignManager.ts | 401-404 | Low | Yes |
| 7.1 | Error Handling | GameShell.ts | 10-13 | Low | No |
| 7.2 | Error Handling | CampaignManager.ts | 479-486 | Low | No |
| 8.1 | Input Validation | GameApp.ts | 283-301 | Medium | No |
| 9 | Testing | 6 components | — | High | Yes |

**Total open issues: 39**
**New this revision: 18**
**Carried over from Review 1: 21** (all 13 original items, plus duplicates now
broken into individual entries with exact line numbers)

---

## Suggested order of work

1. **1.1** — `RosterManager` determinism bug. Breaks replay. One method, one day.
2. **1.2** — Grenade liveness guard. Two lines added to each loop.
3. **2.1** — `director?: any` → `director?: Director`. One interface change, 12 mechanical replacements.
4. **4.1** — Delete 7 private `getDistance` copies, import from `BehaviorUtils`. Search-and-delete, no logic change.
5. **3.1** — `discoveredCells` Set. One structural change in `VisibilityManager`, then swap `.includes()` → `.has()` everywhere.
6. **3.2** — Replace `.sort()[0]` with `reduce`. Four call sites, no logic change.
7. **5.1** — `GameClient.init` options object. One interface, one refactor of the call sites.
8. Everything else in severity order.

---

---

# Voidlock - Comprehensive Code Review

**Version:** 0.106.17
**Review Date:** January 2026
**Reviewer:** Automated Code Analysis
**Review Type:** In-Depth Technical Analysis

______________________________________________________________________

## Executive Summary

This code review examines the Voidlock codebase (~20,759 lines across 559 files) focusing on areas for improvement. The codebase demonstrates strong engineering fundamentals with clear architecture and good testing discipline (276 test files). However, there are significant opportunities for improvement in type safety, code organization, and performance.

### Overall Assessment

| Category | Score | Status |
| --------------- | -------- | ------------- |
| Architecture | 8/10 | ✅ Strong |
| Type Safety | 6/10 | ⚠️ Needs Work |
| Code Quality | 7/10 | ✅ Good |
| Performance | 7/10 | ✅ Good |
| Maintainability | 7/10 | ✅ Good |
| Testing | 8/10 | ✅ Strong |
| **Overall** | **7/10** | ✅ Good |

### Key Findings

- ✅ **Strengths:** Clear architecture, strong testing discipline, deterministic design
- ⚠️ **Critical Issues:** Excessive `any` usage (187 files), performance bottleneck in state cloning
- 📈 **Opportunities:** Code deduplication, manager class refactoring, constants consolidation

______________________________________________________________________

## Table of Contents

1. [Critical Issues](#1-critical-issues)
1. [High Priority Issues](#2-high-priority-issues)
1. [Medium Priority Issues](#3-medium-priority-issues)
1. [Low Priority Issues](#4-low-priority-issues)
1. [Positive Observations](#5-positive-observations)
1. [Refactoring Recommendations](#6-refactoring-recommendations)
1. [Action Plan](#7-action-plan)

______________________________________________________________________

## 1. Critical Issues

### 1.1 Type Safety Degradation - Excessive `any` Usage

**Severity:** 🔴 CRITICAL
**Impact:** Undermines TypeScript's type safety, increases runtime errors
**Affected Files:** 187 files

#### Issue Description

The codebase uses `any` type extensively, defeating TypeScript's type checking and making code error-prone.

#### Critical Locations

##### `src/shared/types/gamestate.ts:112`

```typescript
| { type: "EVENT"; payload: any };
```

**Problem:** Event payload is untyped, making event handling error-prone.

**Recommended Fix:**

```typescript
// Define specific event types
type EventPayload =
  | { type: "SOUND"; soundId: string; position: Vector2 }
  | { type: "COMBAT_LOG"; message: string; severity: "info" | "warning" | "error" }
  | { type: "NOTIFICATION"; text: string }
  | { type: "STATE_CHANGE"; oldState: string; newState: string };

// Update event type
| { type: "EVENT"; payload: EventPayload };
```

##### `src/engine/GameClient.ts:158,207`

```typescript
nodeType: nodeType as any,  // Line 158
private saveMissionConfig(config: any) { // Line 207
```

**Problem:** Type assertions bypass type system; untyped configuration.

**Recommended Fix:**

```typescript
// Define proper types
interface MissionConfig {
  seed: number;
  map: MapDefinition;
  squadConfig: SquadConfig;
  missionType: MissionType;
  nodeType?: CampaignNodeType;
  threatModifier?: number;
}

// Use proper typing
nodeType: nodeType as CampaignNodeType | undefined,
private saveMissionConfig(config: MissionConfig) {
```

##### `src/engine/managers/CampaignManager.ts:269,283,308,336,341`

```typescript
const data = this.storage.load<any>(STORAGE_KEY);
private validateState(data: any): CampaignState | null {
data.roster = data.roster.map((s: any, index: number) => {
```

**Problem:** Validation logic uses `any` for deserialized data.

**Recommended Fix:**

```typescript
const data = this.storage.load<unknown>(STORAGE_KEY);

private validateState(data: unknown): CampaignState | null {
  if (!this.isValidCampaignState(data)) return null;
  // Now TypeScript knows data is CampaignState
  return data;
}

private isValidCampaignState(data: unknown): data is CampaignState {
  if (typeof data !== 'object' || data === null) return false;
  const candidate = data as Record<string, unknown>;

  return (
    typeof candidate.version === 'string' &&
    typeof candidate.seed === 'number' &&
    Array.isArray(candidate.roster) &&
    // ... other checks
  );
}
```

##### `src/engine/managers/UnitManager.ts:63,255,487`

```typescript
director?: any,
].filter((item: any) => {
private getDistance(pos1: Vector2, pos2: Vector2): number {
```

**Problem:** Director parameter is untyped.

**Recommended Fix:**

```typescript
import { Director } from '../Director';

// Use proper type
director?: Director,
```

##### `src/renderer/MenuController.ts:113`

```typescript
constructor(private client: { sendCommand: (cmd: any) => void }) {}
```

**Problem:** Command parameter untyped.

**Recommended Fix:**

```typescript
import { Command } from '@src/shared/types';

constructor(private client: { sendCommand: (cmd: Command) => void }) {}
```

##### `src/renderer/controllers/CommandBuilder.ts:17,30`

```typescript
public static build(ctx: CommandContext, unitIds: string[]): any {
  const base: any = {
```

**Problem:** Return type and intermediate object are `any`.

**Recommended Fix:**

```typescript
import { Command } from '@src/shared/types';

public static build(ctx: CommandContext, unitIds: string[]): Command | null {
  const base: Partial<Command> = {
    unitIds,
    // ...
  };
  // Build command with proper typing
  return finalCommand;
}
```

#### Action Items

1. ✅ Enable `noImplicitAny` in tsconfig.json
1. ✅ Replace all `any` with proper types or `unknown`
1. ✅ Create type guards for runtime validation
1. ✅ Define explicit event payload types
1. ✅ Import and use proper types instead of `any`

**Estimated Effort:** 2-3 days
**Priority:** P0 (Critical)

______________________________________________________________________

### 1.2 Performance Bottleneck - JSON Deep Cloning

**Severity:** 🔴 CRITICAL
**Impact:** Performance degradation, high CPU usage
**Location:** `src/engine/CoreEngine.ts:352`

#### Issue Description

The `getState()` method performs deep cloning of the entire game state via JSON serialization **every 100ms** (10 times per second), causing significant performance overhead.

```typescript
public getState(): GameState {
  const copy = JSON.parse(JSON.stringify(this.state));
  copy.commandLog = [...this.commandLog];
  return copy;
}
```

#### Performance Impact

- **JSON.stringify/parse** is slow for large objects
- Runs 10 times per second (every 100ms state update)
- Game state includes arrays of units, enemies, loot, objectives
- No structural sharing or incremental updates

#### Recommended Fix

**Option 1: Structural Sharing (Preferred)**

```typescript
import { produce } from 'immer';

// Store state as immutable structure
private state: GameState;

public update(deltaTime: number): void {
  // Use Immer for immutable updates
  this.state = produce(this.state, draft => {
    // All mutations happen on draft
    this.updateManagers(draft, deltaTime);
  });
}

public getState(): GameState {
  // No cloning needed - state is already immutable
  return this.state;
}
```

**Option 2: Shallow Clone + Immutable Updates**

```typescript
public getState(): GameState {
  // Shallow clone with spread
  return {
    ...this.state,
    units: [...this.state.units],
    enemies: [...this.state.enemies],
    loot: [...this.state.loot],
    objectives: [...this.state.objectives],
    commandLog: [...this.commandLog],
  };
}
```

**Option 3: Dirty Tracking**

```typescript
private stateCache: GameState | null = null;
private stateDirty: boolean = true;

public getState(): GameState {
  if (!this.stateDirty && this.stateCache) {
    return this.stateCache;
  }

  this.stateCache = this.cloneState(this.state);
  this.stateDirty = false;
  return this.stateCache;
}

private markDirty(): void {
  this.stateDirty = true;
}
```

#### Action Items

1. ✅ Benchmark current cloning performance
1. ✅ Implement Immer.js for immutable updates
1. ✅ Update managers to use immutable patterns
1. ✅ Test performance improvements
1. ✅ Verify determinism is maintained

**Estimated Effort:** 1-2 days
**Priority:** P0 (Critical)

______________________________________________________________________

## 2. High Priority Issues

### 2.1 Code Duplication - `getDistance` Function

**Severity:** 🟡 HIGH
**Impact:** Maintenance burden, inconsistency risk
**Affected Files:** 9 files

#### Issue Description

The `getDistance` utility function is duplicated across 9 files:

1. `src/engine/managers/UnitManager.ts:492`
1. `src/engine/managers/CombatManager.ts:177`
1. `src/engine/managers/CommandExecutor.ts:269`
1. `src/engine/managers/EnemyManager.ts:151`
1. `src/engine/ai/behaviors/SafetyBehavior.ts`
1. `src/engine/ai/behaviors/BehaviorUtils.ts`
1. `src/engine/ai/behaviors/ExplorationBehavior.ts`
1. `src/engine/ai/RangedKiteAI.ts`
1. `src/engine/ai/EnemyAI.ts`

**Duplicated Code:**

```typescript
private getDistance(pos1: Vector2, pos2: Vector2): number {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  return Math.sqrt(dx * dx + dy * dy);
}
```

#### Recommended Fix

**Create:** `src/shared/utils/MathUtils.ts`

```typescript
import { Vector2 } from "../types/geometry";

export class MathUtils {
  /**
   * Calculate Euclidean distance between two points
   */
  public static getDistance(pos1: Vector2, pos2: Vector2): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate Manhattan distance (grid distance)
   */
  public static getManhattanDistance(pos1: Vector2, pos2: Vector2): number {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
  }

  /**
   * Calculate squared distance (faster, no sqrt)
   */
  public static getDistanceSquared(pos1: Vector2, pos2: Vector2): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return dx * dx + dy * dy;
  }
}
```

**Update all 9 files:**

```typescript
import { MathUtils } from "@src/shared/utils/MathUtils";

// Replace all instances
const distance = MathUtils.getDistance(pos1, pos2);
```

#### Action Items

1. ✅ Create `src/shared/utils/MathUtils.ts`
1. ✅ Update all 9 files to use shared utility
1. ✅ Add unit tests for math utilities
1. ✅ Search for other duplicated utilities

**Estimated Effort:** 2-4 hours
**Priority:** P1 (High)

______________________________________________________________________

### 2.2 Manager Classes Too Large

**Severity:** 🟡 HIGH
**Impact:** Maintainability, testability, single responsibility violation
**Affected Files:**

- `src/renderer/app/GameApp.ts` (1185 lines)
- `src/engine/CoreEngine.ts` (552 lines)
- `src/engine/managers/CampaignManager.ts` (524 lines)
- `src/engine/managers/UnitManager.ts` (497 lines)

#### Issue Description

Several manager classes have grown too large and violate the Single Responsibility Principle.

##### `GameApp.ts` - 1185 lines

**Responsibilities:**

- Screen management
- Campaign flow coordination
- Mission setup and teardown
- Event handling
- UI coordination
- Settings management

**Recommended Refactoring:**

**Extract:** `src/renderer/app/CampaignFlowCoordinator.ts`

```typescript
export class CampaignFlowCoordinator {
  constructor(
    private campaignManager: CampaignManager,
    private screenManager: ScreenManager,
    private modalService: ModalService,
  ) {}

  public async startCampaign(config: CampaignConfig): Promise<void> {
    // Campaign initialization logic
  }

  public async handleMissionComplete(report: MissionReport): Promise<void> {
    // Post-mission flow
  }

  public async handleEvent(event: CampaignEvent): Promise<void> {
    // Event handling
  }
}
```

**Extract:** `src/renderer/app/MissionCoordinator.ts`

```typescript
export class MissionCoordinator {
  constructor(
    private gameClient: GameClient,
    private renderer: GameRenderer,
    private inputManager: InputManager,
  ) {}

  public async startMission(config: MissionConfig): Promise<void> {
    // Mission initialization
  }

  public teardownMission(): void {
    // Cleanup
  }
}
```

##### `CoreEngine.ts` - 552 lines

**Issue:** Lines 179-337 contain VIP spawn logic and soldier initialization that should be extracted.

**Recommended Refactoring:**

**Extract:** `src/engine/spawning/UnitSpawner.ts`

```typescript
export class UnitSpawner {
  constructor(
    private grid: GameGrid,
    private prng: PRNG,
  ) {}

  public spawnSquad(squadConfig: SquadConfig, spawnPoints: Vector2[]): Unit[] {
    // Extract soldier spawning logic
  }

  public spawnVIP(vipConfig: VIPConfig, validCells: Vector2[]): VIP | null {
    // Extract VIP spawning logic
  }
}
```

##### `UnitManager.ts` - 497 lines

**Issue:** Lines 82-181 (escort formation logic) is complex and should be extracted.

**Recommended Refactoring:**

**Extract:** `src/engine/formation/FormationManager.ts`

```typescript
export class FormationManager {
  private readonly MAX_VANGUARD = 2;
  private readonly MAX_REARGUARD = 2;

  public assignEscortRoles(
    units: Unit[],
    vip: VIP,
    state: GameState
  ): EscortAssignments {
    // Extract escort formation logic (100 lines)
    return {
      vanguard: [...],
      bodyguard: [...],
      rearguard: [...]
    };
  }
}
```

##### `CampaignManager.ts` - 524 lines

**Issue:** Lines 170-252 duplicate difficulty configuration across 5 switch cases.

**Recommended Refactoring:**

**Extract:** `src/engine/campaign/DifficultyConfig.ts`

```typescript
export interface GameRules {
  spawnTimerEnabled: boolean;
  allowRecruitment: boolean;
  reinforcementsEnabled: boolean;
  deathRule: DeathRule;
  scrapMultiplier: number;
  threatMultiplier: number;
}

export const DIFFICULTY_CONFIGS: Record<string, GameRules> = {
  simulation: {
    spawnTimerEnabled: true,
    allowRecruitment: true,
    reinforcementsEnabled: true,
    deathRule: "Simulation",
    scrapMultiplier: 2.0,
    threatMultiplier: 0.8,
  },
  clone: {
    spawnTimerEnabled: true,
    allowRecruitment: true,
    reinforcementsEnabled: false,
    deathRule: "Clone",
    scrapMultiplier: 1.5,
    threatMultiplier: 1.0,
  },
  iron: {
    spawnTimerEnabled: true,
    allowRecruitment: true,
    reinforcementsEnabled: false,
    deathRule: "Iron",
    scrapMultiplier: 1.0,
    threatMultiplier: 1.2,
  },
  // ... etc
};
```

#### Action Items

1. ✅ Extract CampaignFlowCoordinator from GameApp
1. ✅ Extract MissionCoordinator from GameApp
1. ✅ Extract UnitSpawner from CoreEngine
1. ✅ Extract FormationManager from UnitManager
1. ✅ Create DifficultyConfig constants
1. ✅ Update tests for refactored classes

**Estimated Effort:** 3-5 days
**Priority:** P1 (High)

______________________________________________________________________

### 2.3 Tight Coupling - Circular Dependencies

**Severity:** 🟡 HIGH
**Impact:** Testability, maintainability, circular dependency risk

#### Issue Description

Director and UnitManager are tightly coupled, using `any` to break circular dependency.

**`src/engine/managers/UnitManager.ts:63`**

```typescript
director?: any,
```

**`src/engine/Director.ts`** imports from UnitManager indirectly.

#### Recommended Fix

**Option 1: Define Interface**

```typescript
// src/engine/interfaces/IDirector.ts
export interface IDirector {
  getThreatlevel(): number;
  getTurn(): number;
  update(dt: number, state: GameState): void;
}

// src/engine/managers/UnitManager.ts
import { IDirector } from '../interfaces/IDirector';

director?: IDirector,
```

**Option 2: Dependency Injection**

```typescript
// Use constructor injection instead of property
export class UnitManager {
  constructor(
    private readonly director: IDirector,
    // ... other dependencies
  ) {}
}
```

**Option 3: Event-Based Communication**

```typescript
// Use event emitter pattern
export class Director extends EventEmitter {
  private onThreatChange(): void {
    this.emit("threat-change", { level: this.threatLevel });
  }
}

// UnitManager subscribes to events
director.on("threat-change", (event) => {
  // Handle threat change
});
```

#### Renderer Importing Engine Code

Found 8 renderer files importing from engine:

- `src/renderer/app/GameApp.ts`
- `src/renderer/app/InputBinder.ts`
- `src/renderer/campaign/CampaignManager.ts`
- `src/renderer/campaign/MetaManager.ts`

**Problem:** Renderer should only communicate through `GameClient` and `GameState`.

**Recommended Fix:**
Move campaign managers to `/engine/campaign/` or create facade layer.

```typescript
// src/renderer/campaign/CampaignFacade.ts
export class CampaignFacade {
  constructor(private engineManager: EngineCampaignManager) {}

  // Delegate methods to engine
  public load(): CampaignState | null {
    return this.engineManager.load();
  }
}
```

#### Action Items

1. ✅ Define IDirector interface
1. ✅ Update UnitManager to use interface
1. ✅ Move campaign managers to engine layer
1. ✅ Create facade for renderer access
1. ✅ Update dependency graph documentation

**Estimated Effort:** 1-2 days
**Priority:** P1 (High)

______________________________________________________________________

## 3. Medium Priority Issues

### 3.1 Magic Numbers Throughout Codebase

**Severity:** 🟠 MEDIUM
**Impact:** Maintainability, game balance tuning
**Occurrences:** 117 instances of common magic numbers

#### Critical Examples

**`src/engine/managers/MissionManager.ts:129,139,171,241,286`**

```typescript
hp: nodeType === "Boss" ? 1000 : 500,
maxHp: nodeType === "Boss" ? 1000 : 500,
state.stats.scrapGained += 75 * multiplier;
state.stats.scrapGained += 100 * multiplier;
```

**`src/engine/campaign/MissionReconciler.ts:85,88,202`**

```typescript
const missionXp = report.result === "Won" ? 50 : 10;
const killXp = res.kills * 10;
const canAffordRecruit = state.scrap >= 100;
```

**`src/engine/Director.ts:18,76,154,184`**

```typescript
private readonly turnDuration: number = 10000; // 10 seconds
private readonly threatPerTurn: number = 10; // 10% per turn
const radius = 5;
const scalingTurn = Math.min(this.turn, 10);
```

#### Recommended Fix

**Create:** `src/engine/config/GameConstants.ts`

```typescript
export const GAMEPLAY_CONSTANTS = {
  // Hive Health
  HIVE_HP: {
    BOSS: 1000,
    ELITE: 500,
    NORMAL: 500,
  },

  // Rewards
  SCRAP_REWARDS: {
    HIVE_DESTROY: 75,
    MISSION_WIN: 100,
    MISSION_COMPLETE: 50,
    ELITE_KILL: 25,
    MEDIUM_KILL: 10,
    BASIC_KILL: 5,
  },

  XP_REWARDS: {
    MISSION_WIN: 50,
    MISSION_LOSS: 10,
    SURVIVAL_BONUS: 20,
    KILL: 10,
    OBJECTIVE_COMPLETE: 15,
  },

  // Costs
  RECRUITMENT_COST: 100,
  HEALING_COST_PER_HP: 2,
  EQUIPMENT_UPGRADE_COST: 50,

  // Director
  DIRECTOR: {
    TURN_DURATION_MS: 10000, // 10 seconds
    THREAT_PER_TURN: 10, // 10%
    SPAWN_RADIUS: 5,
    MAX_SCALING_TURNS: 10,
  },

  // Combat
  COMBAT: {
    BASE_DAMAGE: 10,
    CRIT_MULTIPLIER: 2.0,
    MIN_HIT_CHANCE: 0.05, // 5%
    MAX_HIT_CHANCE: 0.95, // 95%
  },

  // Movement
  MOVEMENT: {
    BASE_SPEED: 1.0,
    SPRINT_MULTIPLIER: 1.5,
    ENCUMBERED_MULTIPLIER: 0.7,
  },
} as const;

// Export for convenience
export const HIVE_HP = GAMEPLAY_CONSTANTS.HIVE_HP;
export const SCRAP_REWARDS = GAMEPLAY_CONSTANTS.SCRAP_REWARDS;
export const XP_REWARDS = GAMEPLAY_CONSTANTS.XP_REWARDS;
// ... etc
```

**Update usage:**

```typescript
import {
  HIVE_HP,
  SCRAP_REWARDS,
  XP_REWARDS,
  DIRECTOR,
} from "@src/engine/config/GameConstants";

// Replace magic numbers
hp: (nodeType === "Boss" ? HIVE_HP.BOSS : HIVE_HP.NORMAL,
  (state.stats.scrapGained += SCRAP_REWARDS.HIVE_DESTROY * multiplier));
const missionXp =
  report.result === "Won" ? XP_REWARDS.MISSION_WIN : XP_REWARDS.MISSION_LOSS;
```

#### Action Items

1. ✅ Create `GameConstants.ts` with all constants
1. ✅ Replace magic numbers in MissionManager
1. ✅ Replace magic numbers in MissionReconciler
1. ✅ Replace magic numbers in Director
1. ✅ Replace magic numbers in CombatManager
1. ✅ Update tests to use constants
1. ✅ Document constant meanings

**Estimated Effort:** 1-2 days
**Priority:** P2 (Medium)

______________________________________________________________________

### 3.2 Hardcoded Values in Campaign Initialization

**Severity:** 🟠 MEDIUM
**Impact:** Maintainability, versioning
**Location:** `src/engine/managers/CampaignManager.ts:152`

#### Issue Description

```typescript
this.state = {
  version: "0.106.17", // Hardcoded version
  // ...
  unlockedArchetypes: ["assault", "medic", "scout", "heavy"], // Hardcoded list
};
```

#### Recommended Fix

**Update:** `src/engine/config/CampaignDefaults.ts`

```typescript
import pkg from "../../../package.json";

export const DEFAULT_ARCHETYPES = [
  "assault",
  "medic",
  "scout",
  "heavy",
] as const;
export type DefaultArchetype = (typeof DEFAULT_ARCHETYPES)[number];

export const CAMPAIGN_DEFAULTS = {
  VERSION: pkg.version,
  STARTING_SCRAP: 100,
  STARTING_INTEL: 0,
  STARTING_SECTOR: 0,
  UNLOCKED_ARCHETYPES: DEFAULT_ARCHETYPES,
  MAX_ROSTER_SIZE: 12,
} as const;
```

**Update CampaignManager:**

```typescript
import { CAMPAIGN_DEFAULTS } from "../config/CampaignDefaults";

this.state = {
  version: CAMPAIGN_DEFAULTS.VERSION,
  unlockedArchetypes: [...CAMPAIGN_DEFAULTS.UNLOCKED_ARCHETYPES],
  scrap: CAMPAIGN_DEFAULTS.STARTING_SCRAP,
  // ...
};
```

#### Action Items

1. ✅ Create `CampaignDefaults.ts`
1. ✅ Import version from package.json
1. ✅ Update CampaignManager initialization
1. ✅ Add configuration documentation

**Estimated Effort:** 2-4 hours
**Priority:** P2 (Medium)

______________________________________________________________________

### 3.3 Inefficient Item Visibility Algorithm

**Severity:** 🟠 MEDIUM
**Impact:** Performance (O(n²) complexity)
**Location:** `src/engine/managers/UnitManager.ts:230-260`

#### Issue Description

```typescript
const allVisibleItems = [
  ...(state.loot || []).map((l) => ({ /* ... */ })),
  ...(state.objectives || [])
    .filter((o) => o.state === "Pending" && ...)
    .map((o) => { /* ... */ }),
].filter((item: any) => {
  if (item.visible) return true;
  const cellKey = `${Math.floor(item.pos.x)},${Math.floor(item.pos.y)}`;
  return newVisibleCellsSet.has(cellKey);
});

allVisibleItems.forEach((item) => {
  const unitsSeeingItem = state.units.filter((u) => { /* ... */ });
  // ... nested filtering every frame
});
```

**Problem:** O(n²) nested filtering runs every frame.

#### Recommended Fix

**Option 1: Spatial Partitioning**

```typescript
// Create spatial grid for items
class SpatialGrid<T> {
  private cells: Map<string, T[]> = new Map();

  public insert(item: T, pos: Vector2): void {
    const key = this.getCellKey(pos);
    if (!this.cells.has(key)) {
      this.cells.set(key, []);
    }
    this.cells.get(key)!.push(item);
  }

  public query(cells: string[]): T[] {
    return cells.flatMap((key) => this.cells.get(key) || []);
  }

  private getCellKey(pos: Vector2): string {
    return `${Math.floor(pos.x)},${Math.floor(pos.y)}`;
  }
}

// Usage
const itemGrid = new SpatialGrid<LootItem>();
state.loot.forEach((item) => itemGrid.insert(item, item.pos));

const visibleItems = itemGrid.query(Array.from(newVisibleCellsSet));
```

**Option 2: Cache Visible Items**

```typescript
// Cache visible items per cell
private visibleItemsCache: Map<string, Item[]> = new Map();
private cacheInvalidated: boolean = true;

public updateVisibility(state: GameState, visibleCells: Set<string>): void {
  if (this.cacheInvalidated) {
    this.rebuildVisibilityCache(state, visibleCells);
    this.cacheInvalidated = false;
  }
  // Use cache for fast lookups
}

private rebuildVisibilityCache(state: GameState, visibleCells: Set<string>): void {
  this.visibleItemsCache.clear();
  // Build cache once per visibility change
}
```

#### Action Items

1. ✅ Implement spatial partitioning for items
1. ✅ Update UnitManager to use spatial grid
1. ✅ Benchmark performance improvements
1. ✅ Add tests for spatial queries

**Estimated Effort:** 1 day
**Priority:** P2 (Medium)

______________________________________________________________________

### 3.4 Missing Documentation for Complex Logic

**Severity:** 🟠 MEDIUM
**Impact:** Maintainability, onboarding difficulty

#### Issue Description

Complex algorithms lack explanatory comments.

**`src/engine/managers/MissionManager.ts:76-109`**

```typescript
// No comment explaining Fisher-Yates shuffle
for (let i = candidates.length - 1; i > 0; i--) {
  const j = this.prng.nextInt(0, i);
  [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
}

// Complex objective count logic with no explanation
const count =
  nodeType === "Boss"
    ? 3
    : nodeType === "Elite"
      ? 2
      : Math.min(3, candidates.length);
```

**`src/engine/managers/UnitManager.ts:104-156`**

```typescript
// 53 lines of escort formation logic with no high-level explanation
```

#### Recommended Fix

```typescript
/**
 * Shuffle candidate objectives using Fisher-Yates algorithm
 * to ensure random, unbiased objective selection.
 */
for (let i = candidates.length - 1; i > 0; i--) {
  const j = this.prng.nextInt(0, i);
  [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
}

/**
 * Determine objective count based on mission difficulty:
 * - Boss missions: 3 objectives (high challenge)
 * - Elite missions: 2 objectives (moderate challenge)
 * - Normal missions: Up to 3 objectives (based on availability)
 */
const count =
  nodeType === "Boss"
    ? 3
    : nodeType === "Elite"
      ? 2
      : Math.min(3, candidates.length);
```

```typescript
/**
 * Assign escort formation roles for VIP protection.
 *
 * Formation structure:
 * - Vanguard (2 units): Front protection, path clearing
 * - Bodyguard (1-2 units): Close VIP protection, high priority
 * - Rearguard (2 units): Rear security, prevent flanking
 *
 * Units are assigned based on:
 * - Current position relative to VIP
 * - Unit archetype and capabilities
 * - Formation balance requirements
 */
private assignEscortFormation(units: Unit[], vip: VIP): EscortAssignments {
  // ... implementation
}
```

#### Action Items

1. ✅ Add high-level comments to complex algorithms
1. ✅ Document escort formation logic
1. ✅ Document map generation algorithms
1. ✅ Add JSDoc to public manager methods
1. ✅ Create algorithmic documentation in `/docs`

**Estimated Effort:** 1 day
**Priority:** P2 (Medium)

______________________________________________________________________

## 4. Low Priority Issues

### 4.1 Inconsistent Naming Conventions

**Severity:** 🟢 LOW
**Impact:** Code consistency
**Location:** `src/shared/types/units.ts:162-173`

#### Issue Description

```typescript
export enum EnemyType {
  XenoMite = "Xeno-Mite", // Hyphenated
  WarriorDrone = "Warrior-Drone", // Hyphenated
  SwarmMelee = "SwarmMelee", // CamelCase
  AlienScout = "alien_scout", // snake_case (!)
  Hive = "Hive", // Single word
}
```

#### Recommended Fix

**Standardize to hyphenated format:**

```typescript
export enum EnemyType {
  XenoMite = "xeno-mite",
  WarriorDrone = "warrior-drone",
  PraetorianGuard = "praetorian-guard",
  SpitterAcid = "spitter-acid",
  SwarmMelee = "swarm-melee",
  Hive = "hive",
  Boss = "boss",
  AlienScout = "alien-scout",
  Grunt = "grunt",
  Melee = "melee",
}
```

#### Action Items

1. ✅ Standardize enemy type names
1. ✅ Update all references
1. ✅ Update tests
1. ✅ Check for naming inconsistencies elsewhere

**Estimated Effort:** 1-2 hours
**Priority:** P3 (Low)

______________________________________________________________________

### 4.2 Missing Error Handling Consistency

**Severity:** 🟢 LOW
**Impact:** Error handling predictability
**Location:** Multiple files

#### Issue Description

**`src/engine/managers/CampaignManager.ts:479-486`**

```typescript
public spendScrap(amount: number): void {
  if (!this.state) return; // Silent return
  if (this.state.scrap < amount) {
    throw new Error("Insufficient scrap."); // Throws error
  }
  this.state.scrap -= amount;
  this.save();
}
```

**Problem:** Inconsistent error handling (silent return vs exception).

#### Recommended Fix

```typescript
public spendScrap(amount: number): void {
  if (!this.state) {
    throw new Error("Campaign not initialized");
  }
  if (this.state.scrap < amount) {
    throw new Error(`Insufficient scrap: need ${amount}, have ${this.state.scrap}`);
  }
  this.state.scrap -= amount;
  this.save();
}
```

**`src/renderer/GameShell.ts:10-13`**

```typescript
constructor() {
  this.headerTitle = document.getElementById("header-title")!;
  this.headerControls = document.getElementById("header-controls")!;
  this.mainContent = document.getElementById("main-content")!;
  this.footer = document.getElementById("global-footer")!;
}
```

**Problem:** Non-null assertions without runtime checks.

#### Recommended Fix

```typescript
constructor() {
  this.headerTitle = this.getRequiredElement("header-title");
  this.headerControls = this.getRequiredElement("header-controls");
  this.mainContent = this.getRequiredElement("main-content");
  this.footer = this.getRequiredElement("global-footer");
}

private getRequiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Required DOM element not found: #${id}`);
  }
  return element;
}
```

#### Action Items

1. ✅ Create error handling guidelines
1. ✅ Add runtime checks for DOM elements
1. ✅ Standardize error messages
1. ✅ Add error boundary in UI

**Estimated Effort:** 4-8 hours
**Priority:** P3 (Low)

______________________________________________________________________

### 4.3 Input Validation for Uploaded Maps

**Severity:** 🟢 LOW
**Impact:** Security, robustness
**Location:** `src/renderer/app/GameApp.ts:283-299`

#### Issue Description

```typescript
onLoadStaticMap: async (json) => {
  try {
    this.currentStaticMapData = MapUtility.transformMapData(JSON.parse(json));
    await this.context.modalService.alert("Static Map Loaded.");
  } catch (e) {
    await this.context.modalService.alert("Invalid JSON.");
  }
},
```

**Problem:** No validation of JSON structure before transformation.

#### Recommended Fix

**Create:** `src/shared/validation/MapValidator.ts`

```typescript
import { MapDefinition } from "../types/map";

export class MapValidator {
  public static validateMapData(data: unknown): data is MapDefinition {
    if (typeof data !== "object" || data === null) return false;

    const map = data as Record<string, unknown>;

    // Check required fields
    if (typeof map.width !== "number" || map.width < 10 || map.width > 100) {
      return false;
    }
    if (typeof map.height !== "number" || map.height < 10 || map.height > 100) {
      return false;
    }
    if (!Array.isArray(map.cells)) {
      return false;
    }

    // Validate cell structure
    for (const cell of map.cells) {
      if (!this.isValidCell(cell)) {
        return false;
      }
    }

    return true;
  }

  private static isValidCell(cell: unknown): boolean {
    // Cell validation logic
    return true;
  }
}
```

**Update GameApp:**

```typescript
import { MapValidator } from '@src/shared/validation/MapValidator';

onLoadStaticMap: async (json) => {
  try {
    const parsed = JSON.parse(json);

    if (!MapValidator.validateMapData(parsed)) {
      await this.context.modalService.alert(
        "Invalid map format. Please check the structure."
      );
      return;
    }

    this.currentStaticMapData = MapUtility.transformMapData(parsed);
    await this.context.modalService.alert("Static Map Loaded.");
  } catch (e) {
    await this.context.modalService.alert(`Error loading map: ${e.message}`);
  }
},
```

#### Action Items

1. ✅ Create MapValidator with schema validation
1. ✅ Add validation before map transformation
1. ✅ Add unit tests for validation logic
1. ✅ Improve error messages

**Estimated Effort:** 4 hours
**Priority:** P3 (Low)

______________________________________________________________________

### 4.4 Unsafe Type Coercions

**Severity:** 🟢 LOW
**Impact:** Type safety at boundaries
**Locations:**

- `src/engine/GameClient.ts:158`
- `src/engine/generators/TreeShipGenerator.ts:328`
- `src/engine/generators/SpaceshipGenerator.ts:476`

#### Issue Description

```typescript
nodeType: (nodeType as any, // GameClient.ts:158
  this.openWall(x, y, dir as any)); // TreeShipGenerator.ts:328
```

#### Recommended Fix

```typescript
// Define proper type for direction parameter
type Direction = 'N' | 'S' | 'E' | 'W';

private openWall(x: number, y: number, dir: Direction): void {
  // Implementation
}

// Use type guard instead of assertion
if (this.isValidDirection(dir)) {
  this.openWall(x, y, dir);
}
```

#### Action Items

1. ✅ Define proper types for direction parameters
1. ✅ Replace `as any` with type guards
1. ✅ Add validation at boundaries
1. ✅ Enable stricter type checking

**Estimated Effort:** 2-4 hours
**Priority:** P3 (Low)

______________________________________________________________________

## 5. Positive Observations

### 5.1 Strong Testing Discipline

✅ **276 test files** demonstrate commitment to quality
✅ Comprehensive coverage across unit, integration, and E2E tests
✅ Property-based testing for map generation
✅ Snapshot testing for visual regression

### 5.2 Clean Architecture Separation

✅ Clear engine/renderer split with worker threads
✅ Manager pattern for domain organization
✅ Layer-based rendering architecture
✅ Command pattern for replay support

### 5.3 Deterministic Design

✅ Seeded PRNG for reproducible randomness
✅ Fixed timestep simulation
✅ Command log for perfect replays
✅ No external state dependencies

### 5.4 Strong Type Coverage

✅ TypeScript strict mode enabled (despite `any` issues)
✅ Well-defined interfaces and types
✅ Modular type definitions in `/shared/types`
✅ Most code is properly typed

### 5.5 Storage Abstraction

✅ Clean `StorageProvider` interface pattern
✅ Mock provider for testing
✅ Easy to swap storage implementations

### 5.6 No Technical Debt Markers

✅ No TODO/FIXME comments littering code
✅ Clean commit history
✅ No obvious quick hacks

### 5.7 Documentation

✅ 28 Architecture Decision Records
✅ Comprehensive spec documentation
✅ Dev guide for contributors
✅ README with setup instructions

______________________________________________________________________

## 6. Refactoring Recommendations

### 6.1 Campaign Manager Architecture

**Current Structure:**

```
/src/renderer/campaign/CampaignManager.ts
/src/renderer/campaign/MetaManager.ts
/src/engine/managers/CampaignManager.ts
/src/engine/managers/MetaManager.ts
```

**Problem:** Duplicate manager names in renderer and engine, causing confusion.

**Recommended Structure:**

```
/src/engine/campaign/
  ├── CampaignManager.ts       # Core campaign logic
  ├── MetaManager.ts           # Global statistics
  ├── RosterManager.ts         # Soldier roster
  ├── MissionReconciler.ts     # Post-mission processing
  ├── EventManager.ts          # Random events
  └── DifficultyConfig.ts      # Difficulty configurations

/src/renderer/facade/
  └── CampaignFacade.ts        # Thin wrapper for UI
```

### 6.2 Extract Formation Logic

**Current:** 53 lines of escort formation in UnitManager
**Recommended:** Create `/src/engine/formation/FormationManager.ts`

```typescript
export class FormationManager {
  private readonly MAX_VANGUARD = 2;
  private readonly MAX_REARGUARD = 2;

  public assignEscortRoles(
    units: Unit[],
    vip: VIP,
    state: GameState,
  ): EscortAssignments {
    // Extract escort formation logic
  }

  public updateFormation(
    assignments: EscortAssignments,
    state: GameState,
  ): void {
    // Update formation positions
  }
}
```

### 6.3 Consolidate Constants

**Create unified constants structure:**

```
/src/engine/config/
  ├── GameConstants.ts         # Gameplay values
  ├── CampaignDefaults.ts      # Campaign initialization
  ├── DifficultyConfig.ts      # Difficulty settings
  ├── UnitArchetypes.ts        # Unit definitions
  └── EnemyDefinitions.ts      # Enemy definitions
```

### 6.4 Extract Spawning Logic

**Current:** Spawning logic embedded in CoreEngine and managers
**Recommended:** Create dedicated spawning system

```
/src/engine/spawning/
  ├── UnitSpawner.ts           # Spawn soldiers and VIPs
  ├── EnemySpawner.ts          # Spawn enemies
  ├── LootSpawner.ts           # Spawn loot
  └── SpawnValidator.ts        # Validate spawn locations
```

______________________________________________________________________

## 7. Action Plan

### Phase 1: Critical Fixes (Week 1)

**P0 Issues:**

1. ✅ Fix JSON deep cloning performance (CoreEngine.ts)

   - Implement Immer.js for immutable updates
   - Benchmark performance improvements
   - **Estimated:** 1-2 days

1. ✅ Remove `any` from critical paths

   - Event payloads (gamestate.ts)
   - Storage operations (CampaignManager.ts)
   - Command types (MenuController.ts, CommandBuilder.ts)
   - **Estimated:** 2-3 days

### Phase 2: High Priority (Week 2-3)

**P1 Issues:**

1. ✅ Extract `getDistance` to shared utility

   - Create MathUtils.ts
   - Update all 9 files
   - **Estimated:** 4 hours

1. ✅ Refactor large manager classes

   - Extract CampaignFlowCoordinator
   - Extract MissionCoordinator
   - Extract UnitSpawner
   - Extract FormationManager
   - **Estimated:** 3-5 days

1. ✅ Fix circular dependencies

   - Define IDirector interface
   - Move campaign managers
   - **Estimated:** 1-2 days

### Phase 3: Medium Priority (Week 4-5)

**P2 Issues:**

1. ✅ Consolidate magic numbers

   - Create GameConstants.ts
   - Update all references
   - **Estimated:** 1-2 days

1. ✅ Optimize item visibility

   - Implement spatial partitioning
   - Benchmark improvements
   - **Estimated:** 1 day

1. ✅ Add documentation

   - Document complex algorithms
   - Add JSDoc to public methods
   - **Estimated:** 1 day

### Phase 4: Low Priority (Week 6)

**P3 Issues:**

1. ✅ Standardize naming conventions
1. ✅ Improve error handling
1. ✅ Add input validation
1. ✅ Fix unsafe type coercions

**Estimated:** 1-2 days total

______________________________________________________________________

## Summary

### Technical Debt Score

**Estimated Technical Debt:** Medium (manageable with focused effort)
**Risk Level:** Low (well-tested, no critical vulnerabilities)
**Maintainability Score:** 7/10

### Priority Distribution

| Priority | Issues | Estimated Effort |
| ------------- | ------ | ---------------- |
| P0 (Critical) | 2 | 3-5 days |
| P1 (High) | 3 | 5-8 days |
| P2 (Medium) | 4 | 3-4 days |
| P3 (Low) | 4 | 1-2 days |
| **Total** | **13** | **12-19 days** |

### Key Takeaways

1. **Strong Foundation:** The codebase has a solid architecture with clear patterns
1. **Type Safety Needs Work:** Excessive `any` usage is the biggest concern
1. **Performance Bottleneck:** JSON cloning needs immediate attention
1. **Code Organization:** Some managers are too large and need extraction
1. **Good Testing:** Strong test coverage provides confidence for refactoring

### Recommendations

**Immediate Actions:**

1. Fix performance bottleneck in state cloning
1. Remove `any` from critical paths
1. Extract duplicate utilities

**Medium-Term:**

1. Refactor large manager classes
1. Consolidate constants
1. Improve documentation

**Long-Term:**

1. Implement spatial optimization
1. Standardize naming conventions
1. Enhance error handling

______________________________________________________________________

## Related Documentation

- **Architecture Overview:** `docs/ARCHITECTURE.md`
- **ADRs:** `docs/adr/`
- **Dev Guide:** `spec/dev_guide.md`
- **Core Mechanics:** `spec/core_mechanics.md`
