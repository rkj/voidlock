# Voidlock - Comprehensive Code Review

**Version:** 0.142.4
**Review Date:** March 2026
**Reviewer:** Automated Code Analysis
**Review Type:** In-Depth Technical Analysis (Third Review)

______________________________________________________________________

## Executive Summary

This code review examines the Voidlock codebase (~34,823 lines across 202 source files, 572 test files) focusing on feature coherence, best practices (SOLID, DRY), code quality, and design. This is a follow-up review to the February 2026 analysis.

### Overall Assessment

| Category | Jan | Feb | Current | Change | Status |
| --------------- | ---- | ---- | ------- | ------ | --------- |
| Architecture | 8/10 | 9/10 | 9/10 | → | ✅ Strong |
| Type Safety | 6/10 | 8/10 | 8/10 | → | ✅ Good |
| Code Quality | 7/10 | 7.5/10 | 8/10 | ↑ +0.5 | ✅ Strong |
| Performance | 7/10 | 8/10 | 8.5/10 | ↑ +0.5 | ✅ Strong |
| Maintainability | 7/10 | 7/10 | 7.5/10 | ↑ +0.5 | ✅ Good |
| Testing | 8/10 | 8.5/10 | 9/10 | ↑ +0.5 | ✅ Strong |
| **Overall** | **7/10** | **8/10** | **8.5/10** | ↑ +0.5 | ✅ Strong |

### Key Findings

- ✅ **Previous Issues Addressed:** 9 of 11 actionable issues from prior review resolved or significantly improved
- ✅ **Strengths:** Command pattern fully implemented, AppContext replaced with DI, UnitManager decomposed, IDirector split, Zod schemas expanded
- ⚠️ **Remaining Issues:** HUDManager god class (816 lines), InputManager constructor (20 params), singleton overuse, console.log in production
- 📈 **Opportunities:** Renderer-side decomposition, shared movement logic, campaign soldier creation unification

______________________________________________________________________

## Table of Contents

1. [Previous Review Status](#1-previous-review-status)
1. [Current Issues - High Priority](#2-current-issues---high-priority)
1. [Current Issues - Medium Priority](#3-current-issues---medium-priority)
1. [Current Issues - Low Priority](#4-current-issues---low-priority)
1. [Positive Observations](#5-positive-observations)
1. [Action Plan](#6-action-plan)

______________________________________________________________________

## 1. Previous Review Status

### ✅ RESOLVED Issues (9 of 11)

#### 1.1 Command Type Handling - OCP Violation

**Status:** ✅ RESOLVED

**Previous:** Large if-chains in `CommandHandler.ts` required modification to add new commands.

**Current:**

Fully implemented Command Handler pattern with two registries:

| Component | Purpose | Lines |
| --- | --- | --- |
| `GlobalCommandRegistry` | Game-wide commands (deploy, debug, items) | 19 |
| `UnitCommandRegistry` | Per-unit state transformations | 25 |
| `IGlobalCommandHandler` | Interface for global handlers | ~15 |
| `IUnitCommandHandler` | Interface for unit handlers | ~15 |

10 unit command handlers and 8 global handlers registered via constructor injection. Adding a new command requires only creating a new handler class and registering it — zero modification to existing code.

```
CommandHandler → GlobalCommandRegistry → [Handler per type]
                                        ↓ (for unit commands)
                                        UnitCommandApplier → UnitManager
                                          → CommandExecutor → UnitCommandRegistry → [Handler per type]
```

______________________________________________________________________

#### 1.2 Service Locator Anti-Pattern - AppContext

**Status:** ✅ RESOLVED

**Previous:** `AppContext` was a bag of 12+ public properties passed everywhere.

**Current:** `AppContext.ts` contains only a deprecation comment:

```typescript
// Deprecated: AppContext has been replaced by explicit dependency injection.
```

Replaced by `AppServiceRegistry` which uses explicit constructor injection. Each orchestrator receives only its actual dependencies:

```typescript
// MissionCoordinator gets exactly what it needs
this.missionCoordinator = new MissionCoordinator(
  this.campaignShell,
  this.gameClient,
  this.screenManager,
  this.menuController,
  this.campaignManager,
  (renderer) => config.onRendererCreated(renderer),
);
```

**Note:** `AppContext.ts` is dead code (1 line, just a comment). Should be deleted.

______________________________________________________________________

#### 1.3 SRP Violation - UnitManager God Object

**Status:** ✅ RESOLVED

**Previous:** 675 lines, 7+ responsibilities.

**Current:** 447 lines. Extracted:

| Extracted Class | Lines | Responsibility |
| --- | --- | --- |
| `UnitStateManager` | 208 | Command queue & channeling state |
| `ItemDistributionService` | 192 | Item assignments to units |
| `CommandExecutor` | 68 | Command dispatch via registry |

`UnitManager` is now a pipeline coordinator: stats → queue → escort → channeling → combat → movement → AI. Each step delegates to a specialized sub-manager.

______________________________________________________________________

#### 1.4 Interface Segregation - AIContext

**Status:** ✅ RESOLVED

**Previous:** 8 unrelated properties in a single `AIContext`.

**Current (`src/engine/interfaces/AIContext.ts`):**

```typescript
export interface BehaviorContext {
  agentControlEnabled: boolean;
  totalFloorCells: number;
  claimedObjectives: Map<string, string>;
  executeCommand: (...) => Unit;
}

export interface ObjectiveContext {
  itemAssignments: Map<string, string>;
  itemGrid?: SpatialGrid<VisibleItem>;
}

export interface ExplorationContext {
  gridState?: Uint8Array;
  explorationClaims: Map<string, Vector2>;
}

export interface AIContext extends BehaviorContext, ObjectiveContext, ExplorationContext {}
```

Clean ISP with three focused interfaces composed into one.

______________________________________________________________________

#### 1.5 Interface Segregation - IDirector

**Status:** ✅ RESOLVED

**Previous:** `IDirector` mixed item handling with threat management.

**Current (`src/engine/interfaces/IDirector.ts`):**

```typescript
export interface ItemEffectHandler {
  handleUseItem(state: GameState, cmd: UseItemCommand): void;
}

export interface ThreatDirector {
  getThreatLevel(): number;
  preSpawn(): void;
  update(dt: number): void;
}

export interface IDirector extends ItemEffectHandler, ThreatDirector { ... }
```

Consumers now import only the interface they need (e.g., `ItemEffectHandler` for command handlers).

______________________________________________________________________

#### 1.6 Remaining JSON Deep Clone Locations

**Status:** ✅ MOSTLY RESOLVED

**Previous:** 3 locations using `JSON.parse(JSON.stringify(...))`.

**Current:** Down to 1:

| File | Status |
| --- | --- |
| `MissionSetupManager.ts:269` | ✅ Uses `structuredClone()` |
| `EquipmentScreen.tsx:176` | ❌ Still uses `JSON.parse(JSON.stringify(config))` |

______________________________________________________________________

#### 1.7 Cell Position Flooring Pattern

**Status:** ✅ SIGNIFICANTLY IMPROVED

**Previous:** 131 raw `Math.floor` cell-position patterns across 27 files.

**Current:** `MathUtils` provides proper utilities (`sameCellPosition`, `cellKey`, `getCellCenter`, `toCellCoord`) with 122 usages across the codebase. Raw `Math.floor` reduced from 131 cell-position patterns to ~26 (mostly in render layers for font sizing, not cell logic).

Remaining cell-pattern `Math.floor` in non-render code:
- `TutorialManager.ts:235` — manual cell key instead of `MathUtils.cellKey()`
- `UnitManager.ts:329` — `Math.floor(updatedUnit.pos.x)` for pathfinding input

______________________________________________________________________

#### 1.8 Direct Instantiation in Constructors (EnemyManager)

**Status:** ✅ IMPROVED

AI instances now implement `IEnemyAI` interface properly. `SwarmMeleeAI` and `RangedKiteAI` are strategy implementations. While still directly instantiated in `EnemyManager`, the interface is testable via mock injection in tests.

______________________________________________________________________

#### 1.9 Documentation

**Status:** ✅ IMPROVED

ADR count increased from 32 to **50**. Notable new ADRs:

- ADR-0046: State Separation and Versioning
- ADR-0049: Guided Prologue Flow
- ADR-0050: Reactive UI Binding
- ADR-0051: Vanilla TSX UI

Zod schema coverage expanded to 312 lines across 5 schema files.

______________________________________________________________________

### ⏳ PARTIALLY ADDRESSED (2 of 11)

#### 1.10 Input Validation for Uploaded Maps

**Status:** ⏳ PARTIAL

Zod schemas exist for maps (`src/shared/schemas/map.ts`, 74 lines) but the `GameApp` map-upload flow does not invoke them. Cloud save validation correctly uses `CampaignStateSchema.safeParse()`.

#### 1.11 Error Handling Consistency

**Status:** ⏳ PARTIAL

Logger framework in place. `CoreEngine` still has no error handling — any sub-system exception propagates uncaught to the web worker. Silent returns still present in ~17 renderer locations.

______________________________________________________________________

## 2. Current Issues - High Priority

### 2.1 God Class - HUDManager (816 lines, 10+ responsibilities)

**Severity:** 🔴 HIGH
**Impact:** Maintainability, testability, DRY
**Location:** `src/renderer/ui/HUDManager.ts`

**Responsibilities identified:**

1. HUD DOM initialization
2. UIBinder transformer registry
3. Top bar updates
4. Right panel state machine (Deployment, Game Over, Playing, Mobile)
5. Soldier list rendering
6. Command menu rendering
7. Objective display
8. Enemy intel display
9. Game-over summary
10. Drag-and-drop deployment logic

**DRY Violation:** Mobile speed-slider HTML template is duplicated verbatim between `updateRightPanel()` (lines 206-213) and `updateDeployment()` (lines 383-390), including identical event-listener re-attachment.

**Recommended Refactoring:**

```
HUDManager (coordinator, ~150 lines)
├── DeploymentPanel      # Deployment UI + drag/drop
├── CommandMenuPanel     # Context menu rendering
├── ObjectivesPanel      # Objective list
├── EnemyIntelPanel      # Enemy intel overlay
├── SoldierListPanel     # Unit list
└── GameOverPanel        # End-game summary
```

**Estimated Effort:** 1-2 days
**Priority:** P1

______________________________________________________________________

### 2.2 Constructor Injection Hell - InputManager (20 positional parameters)

**Severity:** 🔴 HIGH
**Impact:** Maintainability, readability, extensibility
**Location:** `src/renderer/InputManager.ts:32-64`

**Problem:** The constructor takes 20 positional parameters. Callers must count arguments to avoid mistakes. Adding a new parameter requires updating all call sites.

```typescript
constructor(
  screenManager, menuController, modalService,
  onTogglePause, onMenuInput, onAbortMission,
  onDeselectAll, getSelectedUnitId, onCanvasClick,
  onToggleDebug, onToggleLos, getCurrentGameState,
  isDebriefVisible, onDeployUnit, onUndeployUnit,
  getCellCoordinates, getWorldCoordinates,
  cycleUnits, panMap, panMapBy, zoomMap,
) { ... }
```

**Recommended Fix:** Use a config object, matching the pattern already used by `InputOrchestrator`:

```typescript
interface InputManagerConfig {
  screenManager: ScreenManager;
  menuController: MenuController;
  // ... explicit named fields
}
```

**Estimated Effort:** 2 hours
**Priority:** P1

______________________________________________________________________

### 2.3 DRY Violation - Spawn Validation Duplicated 4 Times

**Severity:** 🟡 HIGH
**Impact:** Maintenance burden, inconsistency risk
**Locations:** `InputManager.ts` (lines 317, 463, 544), `InputOrchestrator.ts` (line 171)

**Problem:** The spawn-point validation logic is copy-pasted 4 times:

```typescript
state.map.squadSpawns?.some((s) => s.x === cell.x && s.y === cell.y) ||
(state.map.squadSpawn?.x === cell.x && state.map.squadSpawn?.y === cell.y)
```

**Additional DRY violation:** The "find unit at cell during deployment" predicate appears identically 3 times in `InputManager.ts` (mouse down, mouse move, touch start).

**Recommended Fix:**

```typescript
// In MathUtils or a MapUtils module:
export function isValidSpawnPoint(map: MapDefinition, cell: Vector2): boolean {
  return (map.squadSpawns?.some(s => s.x === cell.x && s.y === cell.y) ||
         (map.squadSpawn?.x === cell.x && map.squadSpawn?.y === cell.y)) ?? false;
}
```

**Estimated Effort:** 1 hour
**Priority:** P1

______________________________________________________________________

### 2.4 Singleton Overuse - 5 Static Singletons

**Severity:** 🟡 HIGH
**Impact:** Testability, hidden dependencies
**Locations:** Multiple files

| Singleton | Usage Count | Can Be DI? |
| --- | --- | --- |
| `ThemeManager.getInstance()` | 12 | Yes |
| `AssetManager.getInstance()` | 5 | Yes |
| `InputDispatcher.getInstance()` | 18 | Yes |
| `CampaignManager.getInstance()` | 4 | Yes |
| `MetaManager.getInstance()` | 8 | Yes |

**Problems:**
- `MetaManager.getInstance(this.storage)` called with storage parameter 7 times across `CampaignManager`, but the storage is only used on first construction — subsequent calls silently ignore it
- All singletons expose `resetInstance()` for tests, leaking test concerns into production API
- `InputDispatcher.getInstance()` called from 18 locations across every screen, creating hidden global state dependency

**Recommended Fix:** Inject instances through constructors. `AppServiceRegistry` already owns most of these — pass references explicitly to screens and components.

**Estimated Effort:** 1-2 days
**Priority:** P1

______________________________________________________________________

### 2.5 Director.handleUseItem - Feature Envy (100 lines in wrong class)

**Severity:** 🟡 HIGH
**Impact:** SRP violation, cohesion
**Location:** `src/engine/Director.ts` (handleUseItem method)

**Problem:** `Director` is responsible for threat management and wave spawning, but `handleUseItem()` is a 100-line method implementing heal, grenade, scanner, mine, and sentry logic. It directly mutates `state.enemies`, `state.units`, `state.mines`, and `state.turrets`. It even has special-case logic for `MissionType.Prologue` (never kill friendlies with grenades).

This is Feature Envy — item effect logic belongs in a dedicated `ItemEffectService`, not the threat director.

**Recommended Fix:** Extract `ItemEffectService` implementing `ItemEffectHandler`. Let `Director` delegate to it or remove item handling from `Director` entirely.

**Estimated Effort:** 4 hours
**Priority:** P1

______________________________________________________________________

## 3. Current Issues - Medium Priority

### 3.1 DRY Violation - Enemy Movement Duplicates Unit Movement

**Severity:** 🟠 MEDIUM
**Impact:** Maintenance burden, inconsistency risk
**Location:** `src/engine/managers/EnemyManager.ts` (lines ~85-130)

**Problem:** Enemy movement logic (path following, distance checks, position updates) is a near-copy of `MovementManager.handleMovement()`. Both implement the same physics but with separate code paths. Any bug fix or movement change must be applied in both places.

**Recommended Fix:** Generalize `MovementManager` to handle both units and enemies, or extract a shared `EntityMovement` utility.

**Estimated Effort:** 4 hours
**Priority:** P2

______________________________________________________________________

### 3.2 DRY Violation - Objective Position Resolution (3 copies)

**Severity:** 🟠 MEDIUM
**Impact:** Maintenance burden
**Locations:**
- `ItemDistributionService.refreshItemGrid()` (lines 90-136)
- `ItemDistributionService.getVisibleItems()` (lines 144-190)
- `ObjectiveBehavior` (lines ~80-110)

**Problem:** The pattern for resolving an objective's position (check `targetCell`, fall back to `targetEnemyId` enemy position, default to center) is implemented identically three times:

```typescript
let pos: Vector2 = { x: CENTER_OFFSET, y: CENTER_OFFSET };
if (o.targetCell) {
  pos = { x: o.targetCell.x + CENTER_OFFSET, y: o.targetCell.y + CENTER_OFFSET };
} else if (o.targetEnemyId) {
  const enemy = state.enemies.find(e => e.id === o.targetEnemyId);
  if (enemy) pos = enemy.pos;
}
```

**Recommended Fix:** Add `resolveObjectivePosition(objective, enemies)` to a shared utility module.

**Estimated Effort:** 1 hour
**Priority:** P2

______________________________________________________________________

### 3.3 DRY Violation - Soldier Construction in 3 Places

**Severity:** 🟠 MEDIUM
**Impact:** Inconsistency risk
**Locations:**
- `RosterManager.generateInitialRoster()`
- `RosterManager.recruitSoldier()`
- `EventManager.applyEventChoice()` (lines 91-113)

**Problem:** Campaign soldier creation (archetype lookup, stat generation, name generation) is implemented separately in three locations. A change to default soldier stats requires updating all three.

**Recommended Fix:** Add `SoldierFactory.create(archetypeId, prng)` used by all three call sites.

**Estimated Effort:** 2 hours
**Priority:** P2

______________________________________________________________________

### 3.4 DRY Violation - Campaign Node Advancement (Duplicated)

**Severity:** 🟠 MEDIUM
**Impact:** Logic drift risk
**Location:** `src/engine/campaign/MissionReconciler.ts`

**Problem:** `processMissionResult` and `advanceCampaignWithoutMission` contain identical 25-line blocks for node status advancement:

```typescript
node.status = "Cleared";
state.currentNodeId = node.id;
state.currentSector = node.rank + 2;
state.nodes.forEach(n => {
  if (n.status === "Accessible" && n.id !== node.id) n.status = "Skipped";
});
node.connections.forEach(connId => { ... });
```

**Recommended Fix:** Extract `private advanceNode(state, node)`.

**Estimated Effort:** 30 minutes
**Priority:** P2

______________________________________________________________________

### 3.5 MenuController.getRenderableState() - 200-line Method

**Severity:** 🟠 MEDIUM
**Impact:** Maintainability, SRP
**Location:** `src/renderer/MenuController.ts:477-678`

**Problem:** 200 lines with 6 major conditional branches (one per `MenuState`). Also regenerates `TargetOverlayGenerator.generate()` on every render tick in `TARGET_SELECT` mode — mixing rendering with state mutation.

**Recommended Fix:** Strategy pattern — one renderer per menu state, overlay generation triggered on state transition rather than per frame.

**Estimated Effort:** 1 day
**Priority:** P2

______________________________________________________________________

### 3.6 MissionSetupManager DOM Coupling

**Severity:** 🟠 MEDIUM
**Impact:** Testability, SRP
**Location:** `src/renderer/app/MissionSetupManager.ts:105-117`

**Problem:** `saveCurrentConfig()` reads state from DOM via `document.getElementById("map-seed")` etc. The manager writes to the DOM and reads back from the DOM, creating bidirectional coupling. Cannot be unit-tested without a DOM environment.

**Recommended Fix:** Hold canonical state in memory. DOM is write-only output. Form values propagated via event handlers, not DOM reads.

**Estimated Effort:** 4 hours
**Priority:** P2

______________________________________________________________________

### 3.7 Map Generators - No Shared Base

**Severity:** 🟠 MEDIUM
**Impact:** DRY, extensibility
**Location:** `src/engine/generators/`

**Problem:** `SpaceshipGenerator`, `DenseShipGenerator`, and `TreeShipGenerator` share no interface or base class. Identical utilities duplicated:
- `getBoundaryKey()` — identical in `SpaceshipGenerator` and `DenseShipGenerator`
- Wall-to-`WallDefinition` conversion loops — identical structure in both

**Recommended Fix:** Extract `MapGenerationUtils` or define a `MapGenerator` interface.

**Estimated Effort:** 2 hours
**Priority:** P2

______________________________________________________________________

### 3.8 `console.log` in Production Code (12 occurrences)

**Severity:** 🟠 MEDIUM
**Impact:** Noise in production, professionalism
**Locations:** `InputBinder.ts` (3), `NavigationOrchestrator.ts` (2), `CampaignShell.ts` (2), `ScreenManager.ts` (1), `GameClient.ts` (1), `UIBinder.ts` (2 commented-out)

**Recommended Fix:** Replace with `Logger.debug()` (which respects log level) or remove entirely.

**Estimated Effort:** 30 minutes
**Priority:** P2

______________________________________________________________________

## 4. Current Issues - Low Priority

### 4.1 Remaining `any` Usage (24 occurrences in 9 files)

**Severity:** 🟢 LOW

| Category | Count | Files |
| --- | --- | --- |
| JSX factory (`jsx.ts`, `jsx-types.d.ts`) | 8 | Structural — JSX needs `any` for children |
| TSX components (`CampaignShellUI.tsx`, `SquadBuilder.tsx`, `SoldierInspector.tsx`) | 11 | Should use proper component props |
| Other (`GameApp.ts`, `StatDisplay.tsx`, `UnitUtils.ts`) | 5 | Can be typed |

The JSX factory `any` usage is partially structural (needed for generic DOM element creation), but the TSX components should define proper prop interfaces.

______________________________________________________________________

### 4.2 `as unknown` Casts in SaveManager (5 occurrences)

**Severity:** 🟢 LOW
**Location:** `src/services/SaveManager.ts:91-108`

```typescript
const cloud = (await this.cloudSync.loadCampaign(key)) as unknown as T;
```

The `loadWithSync<T>` method uses generics but then immediately casts to `CampaignState` for conflict resolution. The generic parameter `T` is misleading — this method only works for campaign data. Should be non-generic with `CampaignState` return type.

______________________________________________________________________

### 4.3 `as unknown` Casts in CampaignManager.validateAndRepair (7 occurrences)

**Severity:** 🟢 LOW
**Location:** `src/engine/campaign/CampaignManager.ts:385-453`

The 90-line `validateAndRepair` method manually repairs corrupt saves, duplicating defaults already in the Zod schema. Uses many `as unknown as CampaignState` casts for untyped save data.

**Recommendation:** Use `CampaignStateSchema.safeParse()` with `.default()` transforms to handle missing fields automatically. This would eliminate both the manual repair logic and the unsafe casts.

______________________________________________________________________

### 4.4 GameApp.initializeScreens() - 128-line Method

**Severity:** 🟢 LOW
**Location:** `src/renderer/app/GameApp.ts:200-328`

Contains inline navigation callback logic (especially the debrief callback at lines 222-256) that belongs in `NavigationOrchestrator`.

______________________________________________________________________

### 4.5 StatsManager - JSON Deep Equality

**Severity:** 🟢 LOW
**Location:** `src/engine/managers/StatsManager.ts:84`

```typescript
JSON.stringify(unit.stats) === JSON.stringify(nextStats)
```

Uses JSON serialization for deep equality. At 60Hz with multiple units, this creates many temporary strings. A field-by-field comparison or dirty flag would be more efficient.

______________________________________________________________________

### 4.6 Dead Code

**Severity:** 🟢 LOW

| File | Issue |
| --- | --- |
| `src/renderer/app/AppContext.ts` | 1-line deprecation comment — delete entirely |
| `src/engine/Director.ts` | `@deprecated spawnOneEnemy()` still present |
| `src/renderer/jsx.ts:73-76` | `window.createElement` / `window.Fragment` globals — redundant with module imports |

______________________________________________________________________

### 4.7 EnemyManager String Literal vs Enum

**Severity:** 🟢 LOW
**Location:** `src/engine/managers/EnemyManager.ts`

Uses string literal `"Extracted"` instead of `UnitState.Extracted` enum in one location. Inconsistent with the rest of the codebase.

______________________________________________________________________

## 5. Positive Observations

### 5.1 Architecture Excellence

- ✅ **50 ADRs** documenting architectural decisions (up from 32)
- ✅ **Clean engine/renderer separation** with Web Worker isolation
- ✅ **Command pattern fully implemented** with handler registries — truly Open/Closed
- ✅ **Dependency injection** replaces service locator (AppContext → AppServiceRegistry)
- ✅ **Interface segregation** applied to AIContext (3 focused interfaces) and IDirector (2 focused interfaces)

### 5.2 Codebase Growth and Organization

| Metric | Feb | Mar | Change |
| --- | --- | --- | --- |
| Source Files | 145 | 202 | ↑ 39% |
| Test Files | 375 | 572 | ↑ 53% |
| Lines of Code | 27,101 | 34,823 | ↑ 29% |
| ADRs | 32 | 50 | ↑ 56% |
| Test/Source Ratio | 2.6:1 | 2.8:1 | ↑ Improving |

The test count grew faster than source count — testing discipline is strengthening.

### 5.3 Successful Decompositions Since Last Review

| Original | Extracted | Impact |
| --- | --- | --- |
| `UnitManager` (675 → 447 lines) | `UnitStateManager`, `ItemDistributionService` | SRP resolved |
| `CommandHandler` (was if-chain) | `GlobalCommandRegistry` + 8 handlers | OCP resolved |
| `CommandExecutor` (was if-chain) | `UnitCommandRegistry` + 10 handlers | OCP resolved |
| `AppContext` (12 public fields) | `AppServiceRegistry` (explicit DI) | DIP resolved |
| `IDirector` (monolith) | `ItemEffectHandler` + `ThreatDirector` | ISP resolved |
| `AIContext` (8 unrelated props) | `BehaviorContext` + `ObjectiveContext` + `ExplorationContext` | ISP resolved |

### 5.4 Cloud Sync Architecture

The `SaveManager` → `CloudSyncService` → Firebase pipeline is well-designed:
- Local-first with async cloud backup
- Version-based conflict resolution
- Zod validation on cloud data load
- Anonymous auth with Google/GitHub account linking
- Clean `StorageProvider` abstraction

### 5.5 Reactive UI Binding (ADR-0050)

`UIBinder` implements efficient dirty-checking DOM binding:
- Declarative `data-bind-key` / `data-bind-style` attributes
- Shared transformers via `data-bind-transform`
- Only updates DOM when values change

### 5.6 Vanilla TSX (ADR-0051)

Custom JSX factory enables component-based UI without framework overhead:
- `createElement` produces real DOM nodes
- `Fragment` support
- `ref` callback pattern
- Type-safe event handlers

### 5.7 Deterministic Design Maintained

- ✅ Seeded PRNG throughout
- ✅ Command logging for replays
- ✅ Fixed timestep simulation (16ms)
- ✅ Snapshot-based replay seeking
- ✅ No `Date.now()` or `Math.random()` in engine

______________________________________________________________________

## 6. Action Plan

### Phase 1: Quick Wins (1 Week)

| Task | Effort | Impact |
| --- | --- | --- |
| Extract spawn validation utility | 1h | High — eliminates 4x duplication |
| Extract objective position resolver | 1h | High — eliminates 3x duplication |
| Replace `console.log` with `Logger.debug()` | 30m | Medium — production cleanliness |
| Fix remaining `JSON.parse/stringify` in EquipmentScreen | 15m | Low — consistency |
| Delete dead code (AppContext, deprecated spawnOneEnemy, JSX window globals) | 15m | Low — cleanliness |
| Replace `InputManager` constructor with config object | 2h | High — readability |
| Extract `advanceNode()` in MissionReconciler | 30m | Medium — DRY |

### Phase 2: Decomposition (2-3 Weeks)

| Task | Effort | Impact |
| --- | --- | --- |
| Split HUDManager into 6 panel classes | 1-2d | High — SRP |
| Extract `ItemEffectService` from Director | 4h | High — SRP |
| Unify enemy/unit movement into shared utility | 4h | High — DRY |
| Create `SoldierFactory` for soldier construction | 2h | Medium — DRY |
| Extract `MapGenerationUtils` for generators | 2h | Medium — DRY |
| Fix MissionSetupManager DOM coupling | 4h | Medium — testability |

### Phase 3: Architecture (1-2 Months)

| Task | Effort | Impact |
| --- | --- | --- |
| Replace singletons with constructor-injected instances | 2-3d | High — testability |
| Add Zod validation to map upload flow | 4h | Medium — robustness |
| Add error boundary in CoreEngine (try/catch in simulationStep) | 2h | Medium — resilience |
| Strategy pattern for MenuController.getRenderableState | 1d | Medium — OCP |

______________________________________________________________________

## Summary

### Technical Debt Trend

| Metric | Jan | Feb | Mar |
| --- | --- | --- | --- |
| Technical Debt | Medium | Low-Medium | Low |
| Risk Level | Low | Low | Low |
| Maintainability | 7/10 | 7/10 | 7.5/10 |

### Key Takeaways

1. **Strong upward trajectory:** 9 of 11 previous issues resolved. Overall score improved from 8/10 to 8.5/10.
2. **Engine layer is clean:** Command pattern, interface segregation, and manager decomposition are production-quality.
3. **Renderer layer needs attention:** HUDManager, InputManager, and MenuController are the remaining large classes.
4. **Testing discipline is excellent:** 2.8:1 test-to-source ratio with 572 test files.
5. **Singleton pattern** is the most pervasive remaining anti-pattern, affecting testability across the renderer.

### What's Working Well

- Command pattern with handler registries
- AIContext interface segregation
- Campaign modularization
- Cloud sync architecture
- ADR documentation discipline
- Deterministic simulation design

### Primary Remaining Debt

1. HUDManager god class (816 lines)
2. Singleton overuse (5 classes, 47 call sites)
3. InputManager constructor (20 params)
4. Director item handling (feature envy)
5. Duplicated movement logic (enemy vs unit)

______________________________________________________________________

## Appendix: Metrics

| Metric | Value |
| --- | --- |
| Source Files | 202 |
| Test Files | 572 |
| Lines of Code | 34,823 |
| ADRs | 50 |
| Zod Schemas | 5 files, 312 lines |
| External Dependencies | 3 (firebase, zod, gemini-cli) |
| TypeScript Strict Mode | Enabled |
| Test/Source Ratio | 2.8:1 |
| `any` occurrences | 24 (down from 11 functional, up from JSX additions) |
| `console.log` in prod | 12 |
| Singleton classes | 5 |
| Largest file | HUDManager.ts (816 lines) |
