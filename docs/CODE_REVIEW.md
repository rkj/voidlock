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
