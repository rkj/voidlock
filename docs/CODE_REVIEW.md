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
