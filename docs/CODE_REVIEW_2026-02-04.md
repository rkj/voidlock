# Voidlock - Comprehensive Code Review

**Version:** 0.123.1
**Review Date:** February 2026
**Reviewer:** Automated Code Analysis
**Review Type:** In-Depth Technical Analysis

______________________________________________________________________

## Executive Summary

This code review examines the Voidlock codebase (~27,101 lines across 145 source files, 375 test files) focusing on feature coherence, best practices (SOLID, DRY), code quality, and design. This is a follow-up review to the January 2026 analysis.

### Overall Assessment

| Category | Previous | Current | Change | Status |
| --------------- | -------- | -------- | ------ | --------- |
| Architecture | 8/10 | 9/10 | ↑ +1 | ✅ Strong |
| Type Safety | 6/10 | 8/10 | ↑ +2 | ✅ Good |
| Code Quality | 7/10 | 7.5/10 | ↑ +0.5 | ✅ Good |
| Performance | 7/10 | 8/10 | ↑ +1 | ✅ Strong |
| Maintainability | 7/10 | 7/10 | → | ✅ Good |
| Testing | 8/10 | 8.5/10 | ↑ +0.5 | ✅ Strong |
| **Overall** | **7/10** | **8/10** | ↑ +1 | ✅ Good |

### Key Findings

- ✅ **Previous Issues Addressed:** 8 of 13 major issues from prior review resolved
- ✅ **Strengths:** Clean architecture, extracted modules, improved type safety
- ⚠️ **Remaining Issues:** Cell position pattern duplication (131 occurrences), UnitManager complexity
- 📈 **Opportunities:** Interface segregation, DI improvements, utility extraction

______________________________________________________________________

## Table of Contents

1. [Previous Review Status](#1-previous-review-status)
1. [Current Issues - High Priority](#2-current-issues---high-priority)
1. [Current Issues - Medium Priority](#3-current-issues---medium-priority)
1. [Current Issues - Low Priority](#4-current-issues---low-priority)
1. [Positive Observations](#5-positive-observations)
1. [Future Technical Direction](#6-future-technical-direction)
1. [Action Plan](#7-action-plan)

______________________________________________________________________

## 1. Previous Review Status

### ✅ RESOLVED Issues (8 of 13)

#### 1.1 Type Safety - Excessive `any` Usage

**Status:** ✅ SIGNIFICANTLY IMPROVED

| Metric | Previous | Current | Change |
| ----------------- | -------- | ------- | ---------- |
| Files with `any` | 187 | 9 | ↓ 95% |
| Total occurrences | Unknown | 11 | ↓ Dramatic |

**Evidence:**

- `any` reduced to 11 occurrences in 9 files
- Proper types now used for events, commands, and state
- `IDirector` interface created and used across 13 files

**Remaining `any` Locations:**

- `src/engine/Director.ts:1` (scanner callback)
- `src/engine/map/MapValidator.ts:1` (validation input)
- `src/renderer/app/GameApp.ts:2` (event handlers)
- `src/renderer/ui/SoldierWidget.ts:2` (DOM events)

______________________________________________________________________

#### 1.2 Performance Bottleneck - JSON Deep Cloning

**Status:** ✅ RESOLVED

**Previous Code:**

```typescript
public getState(): GameState {
  return JSON.parse(JSON.stringify(this.state)); // Expensive
}
```

**Current Code (CoreEngine.ts:295-336):**

```typescript
public getState(): GameState {
  // Manual shallow copy of the state structure.
  // We avoid deep cloning elements here because postMessage()
  // in the worker performs a structured clone anyway.
  const copy: GameState = {
    ...state,
    units: [...state.units],
    enemies: [...state.enemies],
    loot: [...state.loot],
    // ... efficient shallow copies
  };
  return copy;
}
```

**Improvement:** Eliminated redundant JSON serialization.

______________________________________________________________________

#### 1.3 Code Duplication - `getDistance` Function

**Status:** ✅ RESOLVED

**Created:** `src/shared/utils/MathUtils.ts`

```typescript
export class MathUtils {
  public static getDistance(pos1: Vector2, pos2: Vector2): number;
  public static getManhattanDistance(pos1: Vector2, pos2: Vector2): number;
  public static getDistanceSquared(pos1: Vector2, pos2: Vector2): number;
  public static clamp(val: number, min: number, max: number): number;
}
```

**Note:** Still 23 files import `getDistance`, some may have local duplicates remaining (see Issue 2.1).

______________________________________________________________________

#### 1.4 Manager Classes Too Large - Extraction

**Status:** ✅ PARTIALLY RESOLVED

**Extracted Components:**

| Component | Lines | Purpose |
| ---------------------------- | ----- | ---------------------------- |
| `CampaignFlowCoordinator.ts` | 104 | Campaign flow orchestration |
| `MissionCoordinator.ts` | 341 | Mission lifecycle management |
| `FormationManager.ts` | 115 | Escort formation logic |
| `UnitSpawner.ts` | 249 | Unit spawning logic |
| `RosterManager.ts` | 178 | Roster management |
| `EventManager.ts` | 132 | Campaign event handling |
| `MissionReconciler.ts` | 218 | Post-mission processing |

**Size Reduction:**

| File | Previous | Current | Change |
| -------------------- | -------- | ------- | ---------------- |
| `GameApp.ts` | 1185 | 801 | ↓ 32% |
| `CoreEngine.ts` | 552 | 496 | ↓ 10% |
| `CampaignManager.ts` | 524 | 632\* | ↑ (restructured) |

\*CampaignManager moved to `/engine/campaign/` with better modularity.

**Remaining:** `UnitManager.ts` still at 675 lines (see Issue 2.2).

______________________________________________________________________

#### 1.5 Tight Coupling - Circular Dependencies

**Status:** ✅ RESOLVED

**Created:** `src/engine/interfaces/IDirector.ts`

```typescript
export interface IDirector {
  handleUseItem(state: GameState, cmd: UseItemCommand): void;
  getThreatLevel(): number;
  update(dt: number): void;
  preSpawn(): void;
}
```

**Usage:** 13 files now import `IDirector` instead of concrete `Director`.

______________________________________________________________________

#### 1.6 Magic Numbers - Constants Consolidation

**Status:** ✅ RESOLVED

**Created:** `src/engine/config/GameConstants.ts` (136 lines)

Covers:

- `HIVE` - Health and difficulty values
- `SCRAP_REWARDS` - Reward amounts
- `XP_REWARDS` - Experience values
- `DIRECTOR` - Spawn timing and threat
- `ITEMS` - Item parameters
- `COMBAT` - Combat mechanics
- `AI` - AI thresholds
- `MOVEMENT` - Movement parameters

______________________________________________________________________

#### 1.7 Naming Conventions - EnemyType

**Status:** ✅ RESOLVED

**Previous:**

```typescript
XenoMite = "Xeno-Mite",     // Inconsistent
SwarmMelee = "SwarmMelee",  // CamelCase
AlienScout = "alien_scout", // snake_case
```

**Current (units.ts:172-183):**

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

______________________________________________________________________

#### 1.8 Campaign Manager Architecture

**Status:** ✅ RESTRUCTURED

**New Structure:**

```
src/engine/campaign/
├── CampaignManager.ts    (632 lines - core logic)
├── RosterManager.ts      (178 lines)
├── EventManager.ts       (132 lines)
├── MissionReconciler.ts  (218 lines)
├── MetaManager.ts        (153 lines)
└── RosterUtils.ts        (23 lines)
```

Re-export maintained at `src/engine/managers/CampaignManager.ts` for compatibility.

______________________________________________________________________

### ⏳ PARTIALLY ADDRESSED Issues (3 of 13)

#### 1.9 Inefficient Item Visibility Algorithm

**Status:** ⏳ PARTIAL

`SpatialGrid` class exists but cell position flooring still scattered (131 occurrences).

#### 1.10 Missing Documentation

**Status:** ⏳ PARTIAL

ADR count increased from 28 to 32. Algorithm documentation still sparse.

#### 1.11 Error Handling Consistency

**Status:** ⏳ PARTIAL

Some improvements but silent returns still present in critical paths.

______________________________________________________________________

### ❌ NOT ADDRESSED Issues (2 of 13)

#### 1.12 Input Validation for Uploaded Maps

**Status:** ❌ NOT ADDRESSED

Still uses basic try/catch without schema validation.

#### 1.13 Unsafe Type Coercions

**Status:** ❌ MINIMAL PROGRESS

Some `as any` replaced but pattern persists in generators.

______________________________________________________________________

## 2. Current Issues - High Priority

### 2.1 DRY Violation - Cell Position Flooring Pattern

**Severity:** 🔴 HIGH
**Impact:** Maintenance burden, inconsistency risk
**Occurrences:** 131 across 27 files

**Problem:** The pattern `Math.floor(pos.x), Math.floor(pos.y)` is repeated extensively:

```typescript
// Appears 131 times in variations like:
Math.floor(unit.pos.x) === Math.floor(other.pos.x);
const cellX = Math.floor(enemy.pos.x);
`${Math.floor(pos.x)},${Math.floor(pos.y)}`;
```

**Files Most Affected:**

- `EnemyManager.ts` - 10 occurrences
- `ObjectiveBehavior.ts` - 9 occurrences
- `SafetyBehavior.ts` - 9 occurrences

**Recommended Fix:**

Add to `src/shared/utils/MathUtils.ts`:

```typescript
export function toCellCoord(pos: Vector2): { x: number; y: number } {
  return { x: Math.floor(pos.x), y: Math.floor(pos.y) };
}

export function cellKey(pos: Vector2): string {
  return `${Math.floor(pos.x)},${Math.floor(pos.y)}`;
}

export function sameCellPosition(pos1: Vector2, pos2: Vector2): boolean {
  return (
    Math.floor(pos1.x) === Math.floor(pos2.x) &&
    Math.floor(pos1.y) === Math.floor(pos2.y)
  );
}
```

**Estimated Effort:** 4-6 hours
**Priority:** P1

______________________________________________________________________

### 2.2 SRP Violation - UnitManager God Object

**Severity:** 🔴 HIGH
**Impact:** Maintainability, testability
**Location:** `src/engine/managers/UnitManager.ts` (675 lines)

**Current Responsibilities (7+):**

1. Command queue processing
1. Escort formation delegation
1. Item assignment and spatial queries
1. Stats recalculation
1. Movement coordination
1. Combat delegation
1. AI behavior orchestration
1. Visibility management

**Problem:** The `update()` method is 88 lines mixing multiple concerns.

**Recommended Refactoring:**

Extract:

- `UnitStateManager` - command queue & channeling state
- `ItemDistributionService` - item assignments to units
- Keep `UnitManager` as orchestration facade only

**Estimated Effort:** 1-2 days
**Priority:** P1

______________________________________________________________________

### 2.3 Command Type Handling - OCP Violation

**Severity:** 🟡 HIGH
**Impact:** Extensibility, maintenance
**Location:** `CommandHandler.ts`, `CommandExecutor.ts`

**Problem:** Large if-chains require modification to add new commands:

```typescript
// CommandHandler.ts - 13 if-statements
if (cmd.type === CommandType.USE_ITEM) { ... }
if (cmd.type === CommandType.TOGGLE_DEBUG_OVERLAY) { ... }
if (cmd.type === CommandType.TOGGLE_LOS_OVERLAY) { ... }
// ...
```

**Recommended Fix:**

Implement Command Handler pattern:

```typescript
interface ICommandHandler {
  canHandle(cmd: Command): boolean;
  handle(unit: Unit, cmd: Command, state: GameState): Unit;
}

class CommandRegistry {
  private handlers: ICommandHandler[] = [];

  register(handler: ICommandHandler): void { ... }
  execute(cmd: Command, state: GameState): void { ... }
}
```

**Estimated Effort:** 1 day
**Priority:** P1

______________________________________________________________________

### 2.4 Service Locator Anti-Pattern - AppContext

**Severity:** 🟡 HIGH
**Impact:** Testability, hidden dependencies
**Location:** `src/renderer/app/AppContext.ts`

**Problem:**

```typescript
export class AppContext {
  public gameClient!: GameClient;
  public renderer?: Renderer;
  public screenManager!: ScreenManager;
  public campaignManager!: CampaignManager;
  public modalService!: ModalService;
  // ... 9 more public properties
}

// Used everywhere
constructor() {
  this.missionCoordinator = new MissionCoordinator(this.context); // Gets EVERYTHING
}
```

**Issues:**

- Hidden dependencies (classes can access any service)
- Hard to test (need to mock entire context)
- No clear dependency graph

**Recommended Fix:**

Replace with explicit constructor injection:

```typescript
class MissionCoordinator {
  constructor(
    private gameClient: GameClient,
    private screenManager: ScreenManager,
    // Only what's actually needed
  ) {}
}
```

**Estimated Effort:** 2-3 days
**Priority:** P1

______________________________________________________________________

## 3. Current Issues - Medium Priority

### 3.1 Interface Segregation - AIContext God Parameter

**Severity:** 🟠 MEDIUM
**Location:** `src/engine/managers/UnitAI.ts:33-48`

```typescript
export interface AIContext {
  agentControlEnabled: boolean;
  totalFloorCells: number;
  gridState?: Uint8Array;
  claimedObjectives: Map<string, string>;
  explorationClaims: Map<string, Vector2>;
  itemAssignments: Map<string, string>;
  itemGrid?: SpatialGrid<VisibleItem>;
  executeCommand: (...) => Unit;
}
```

**Problem:** 8 unrelated properties; not all behaviors need all properties.

**Recommended Fix:**

```typescript
interface BehaviorContext {
  agentControlEnabled: boolean;
  executeCommand: (...) => Unit;
}

interface ObjectiveContext {
  claimedObjectives: Map<string, string>;
  itemAssignments: Map<string, string>;
}
```

**Estimated Effort:** 4 hours
**Priority:** P2

______________________________________________________________________

### 3.2 Interface Segregation - IDirector Too Broad

**Severity:** 🟠 MEDIUM
**Location:** `src/engine/interfaces/IDirector.ts`

```typescript
export interface IDirector {
  handleUseItem(state: GameState, cmd: UseItemCommand): void;
  getThreatLevel(): number;
  update(dt: number): void;
  preSpawn(): void;
}
```

**Problem:** Mixes item handling with threat management concerns.

**Recommended Fix:**

```typescript
interface ItemEffectHandler {
  handleUseItem(state: GameState, cmd: UseItemCommand): void;
}

interface ThreatDirector {
  getThreatLevel(): number;
  preSpawn(): void;
  update(dt: number): void;
}
```

**Estimated Effort:** 2 hours
**Priority:** P2

______________________________________________________________________

### 3.3 Remaining JSON Deep Clone Locations

**Severity:** 🟠 MEDIUM
**Locations:** 3 files

```typescript
// MissionSetupManager.ts:258
this.currentSquad = JSON.parse(JSON.stringify(defaults.squadConfig));

// EquipmentScreen.ts:39, 70
this.config = JSON.parse(JSON.stringify(initialConfig));
```

**Recommended Fix:** Use spread operator or structuredClone.

**Estimated Effort:** 1 hour
**Priority:** P2

______________________________________________________________________

### 3.4 Direct Instantiation in Constructors

**Severity:** 🟠 MEDIUM
**Location:** `src/engine/managers/EnemyManager.ts:26-29`

```typescript
constructor() {
  this.meleeAI = new SwarmMeleeAI();  // Hard to test
  this.rangedAI = new RangedKiteAI();
}
```

**Recommended Fix:** Accept AI instances in constructor for testability.

**Estimated Effort:** 2 hours
**Priority:** P2

______________________________________________________________________

## 4. Current Issues - Low Priority

### 4.1 Remaining Silent Returns

**Severity:** 🟢 LOW
**Locations:** Multiple renderer files

```typescript
// 17+ locations like:
if (!this.soldier) return;
if (!this.state) return;
if (!this.container) return;
```

**Recommendation:** Add error logging or convert to assertions in development.

______________________________________________________________________

### 4.2 Map Validation Still Missing

**Severity:** 🟢 LOW
**Location:** `src/renderer/app/GameApp.ts`

Still uses basic try/catch without schema validation for uploaded maps.

______________________________________________________________________

## 5. Positive Observations

### 5.1 Architecture Excellence

- ✅ **32 ADRs** documenting architectural decisions
- ✅ **Clean engine/renderer separation** with Web Worker isolation
- ✅ **Behavior pattern** for AI is well-designed and extensible
- ✅ **IEnemyAI interface** properly implemented with SwarmMelee and RangedKite strategies

### 5.2 Type Safety Improvements

- ✅ `any` usage reduced by 95%
- ✅ Strict TypeScript enabled (`strict: true`)
- ✅ Proper interface definitions for cross-module contracts

### 5.3 Testing Discipline

- ✅ **375 test files** (2.6x ratio to source)
- ✅ Unit, integration, and E2E coverage
- ✅ Property-based testing for map generation

### 5.4 Performance Optimizations

- ✅ JSON deep cloning eliminated from hot path
- ✅ Shallow copying with spread operators
- ✅ Map data sent only once, then omitted

### 5.5 Code Organization

- ✅ Campaign logic properly modularized
- ✅ Coordinators extracted from GameApp
- ✅ Constants consolidated in GameConstants.ts
- ✅ Shared utilities in MathUtils.ts

### 5.6 Deterministic Design

- ✅ Seeded PRNG maintained
- ✅ Command logging for replays
- ✅ Fixed timestep simulation

______________________________________________________________________

## 6. Future Technical Direction

### 6.1 Frontend Framework Decision

**Current Decision (ADR-0029):** Stay with Vanilla TypeScript

**Rationale Review:**

- ✅ Bundle size minimal (~zero runtime deps)
- ✅ Full control over render timing
- ✅ No framework "magic" in deterministic simulation
- ⚠️ Complex screens (EquipmentScreen, SquadBuilder) have manual DOM management

**Recommendation:** **Maintain current approach** with these caveats:

1. **If adding complex nested UI** (Codex, social features, node editor):

   - Evaluate **SolidJS** or **Svelte** (no VDOM overhead)
   - Create hybrid: Canvas for game, framework for menus

1. **Near-term improvements:**

   - Extract reusable DOM helpers (like StatDisplay, ModalService pattern)
   - Create component library for common patterns

______________________________________________________________________

### 6.2 Server Persistence & Users

**Current State:** LocalStorage-only, single-player

**Options Analysis:**

| Option | Complexity | Benefit | Risk |
| --------------------- | ---------- | ----------------------------- | ------------------------- |
| A. Cloud Save Sync | Medium | Progress backup, multi-device | Auth complexity |
| B. Multiplayer Server | High | New gameplay modes | Major architecture change |
| C. Leaderboards Only | Low | Competition, engagement | Limited value |
| D. Keep Single-Player | None | Focus on core game | Limited engagement |

**Recommendation:** **Phased approach**

**Phase 1 (Near-term):**

- Add optional cloud save sync via simple backend
- Use anonymous tokens (no account required)
- Technology: Firebase/Supabase for fast implementation

**Phase 2 (If warranted):**

- Optional user accounts for persistent stats
- Cross-device campaign sync
- Global leaderboards

**Phase 3 (Long-term consideration):**

- Async multiplayer (shared campaigns, challenges)
- Requires determinism audit (currently good foundation)

______________________________________________________________________

### 6.3 Recommended Technical Improvements

**Priority 1 - Quick Wins:**

1. Extract cell position utilities (4-6 hours)
1. Split IDirector interface (2 hours)
1. Remove remaining JSON.parse/stringify (1 hour)

**Priority 2 - Architecture:**

1. Replace AppContext service locator with DI (2-3 days)
1. Break up UnitManager (1-2 days)
1. Implement Command Handler pattern (1 day)

**Priority 3 - Future Foundation:**

1. Add telemetry/analytics hooks for balance data
1. Prepare persistence abstraction for cloud sync
1. Document AI behavior system for content expansion

______________________________________________________________________

### 6.4 Technology Stack Recommendations

**Keep:**

- TypeScript 5.9 (excellent)
- Vite 7.2 (excellent)
- Vitest (excellent)
- Canvas 2D rendering (appropriate for pixel art)
- Web Workers for determinism

**Consider Adding:**

- `zod` - Runtime schema validation for saves and uploaded maps
- `immer` - Immutable state updates (if state complexity grows)
- `@tanstack/query` - If adding server sync (caching, retry logic)

**Avoid:**

- React/Vue for game UI (overhead not justified)
- Heavy state management (Redux, MobX) - current approach sufficient

______________________________________________________________________

## 7. Action Plan

### Phase 1: Immediate (1 Week)

| Task | Effort | Impact |
| ------------------------------- | ------ | -------------------- |
| Extract cell position utilities | 4-6h | High - DRY |
| Remove JSON.parse/stringify x3 | 1h | Medium - Perf |
| Split IDirector interface | 2h | Medium - ISP |
| Add remaining `any` fixes | 2h | Medium - Type safety |

### Phase 2: Short-term (2-3 Weeks)

| Task | Effort | Impact |
| --------------------------------- | ------ | ------------------ |
| Replace AppContext with DI | 2-3d | High - Testability |
| Split UnitManager | 1-2d | High - SRP |
| Implement Command Handler pattern | 1d | Medium - OCP |
| Add map validation schema | 4h | Low - Robustness |

### Phase 3: Medium-term (1-2 Months)

| Task | Effort | Impact |
| ------------------------- | ------ | ---------------------- |
| Cloud save sync (Phase 1) | 1w | Medium - UX |
| Document AI behaviors | 2d | Medium - Extensibility |
| Component library for DOM | 1w | Medium - DX |

______________________________________________________________________

## Summary

### Technical Debt Score

| Metric | Previous | Current |
| --------------- | -------- | ---------- |
| Technical Debt | Medium | Low-Medium |
| Risk Level | Low | Low |
| Maintainability | 7/10 | 7/10 |

### Key Takeaways

1. **Significant Progress:** 8 of 13 major issues from January review resolved
1. **Type Safety Improved:** `any` usage reduced by 95%
1. **Architecture Matured:** Good extraction of coordinators and managers
1. **Main Remaining Issue:** Cell position pattern duplication (131 occurrences)
1. **DI Pattern Needed:** AppContext service locator should be replaced

### Recommendations

**Immediate Actions:**

1. Add cell position utility functions
1. Fix remaining 3 JSON deep clone locations
1. Split broad interfaces (IDirector, AIContext)

**Near-term:**

1. Replace AppContext with explicit DI
1. Break up UnitManager
1. Consider cloud save sync for user retention

**Long-term:**

1. Evaluate framework only if adding complex non-game UI
1. Maintain deterministic design as multiplayer foundation
1. Document systems for content team expansion

______________________________________________________________________

## Appendix: Metrics

| Metric | Value |
| ---------------------- | ------------------------- |
| Source Files | 145 |
| Test Files | 375 |
| Lines of Code | 27,101 |
| ADRs | 32 |
| External Dependencies | 1 (Gemini CLI - dev only) |
| TypeScript Strict Mode | Enabled |
| Test/Source Ratio | 2.6:1 |
