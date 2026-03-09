# Voidlock - Future Technical Direction

**Version:** 0.142.4
**Date:** March 2026

______________________________________________________________________

## Overview

This document outlines the technical roadmap for Voidlock, building on the current architecture (Web Worker simulation, Canvas rendering, Firebase cloud sync) and the project's strengths (deterministic engine, strong testing, clean separation of concerns). The proposals are organized into near-term, medium-term, and long-term horizons with concrete architectural guidance.

______________________________________________________________________

## 1. Server Persistence and Users

### Current State

- **Storage:** Local-first (`LocalStorageProvider`) with optional Firebase cloud backup (`CloudSyncService`)
- **Auth:** Anonymous Firebase auth with Google/GitHub account linking
- **Sync:** Version-based conflict resolution, async cloud backup on save
- **Validation:** Zod schemas validate cloud data on load

### Phase 1: Hardened Cloud Save (Near-term, 2-4 weeks)

**Goal:** Make cloud save production-reliable.

**Tasks:**

1. **Fix sync race condition.** `SaveManager.syncToCloud()` skips the request if `syncInProgress` is true. This silently drops saves. Replace with a write queue that coalesces rapid saves:

   ```typescript
   class WriteQueue {
     private pendingData: CampaignState | null = null;
     private flushing = false;

     enqueue(data: CampaignState): void {
       this.pendingData = data;  // Latest write always wins
       if (!this.flushing) this.flush();
     }

     private async flush(): Promise<void> {
       this.flushing = true;
       while (this.pendingData) {
         const data = this.pendingData;
         this.pendingData = null;
         await this.cloudSync.saveCampaign(key, data);
       }
       this.flushing = false;
     }
   }
   ```

1. **Upgrade Firebase persistence API.** Replace deprecated `enableIndexedDbPersistence()` with `initializeFirestore()` + `persistentLocalCache()` for Firebase SDK v12 compatibility.

1. **Add timestamp-based conflict resolution.** Current `saveVersion` counter is fragile (two fresh campaigns both start at version 1). Add `lastModifiedAt` timestamp (client-generated, for conflict detection) alongside the existing version counter.

1. **Validate campaign summaries.** `listCampaigns()` returns unvalidated metadata from Firestore. Add `CampaignSummarySchema.safeParse()` on the results for consistency with `loadCampaign()`.

1. **Add cloud deletion support.** `SaveManager.remove()` only deletes locally. Add optional `deleteFromCloud` parameter for explicit user-initiated campaign deletion.

### Phase 2: User Accounts and Profiles (Medium-term, 1-2 months)

**Goal:** Persistent user identity with cross-device sync and player profiles.

**Architecture:**

```
┌─────────────────┐     ┌────────────────────────┐     ┌──────────────┐
│   Voidlock       │     │   Firebase              │     │   Firestore   │
│   Client         │────►│   Auth                  │────►│   Database    │
│                  │     │   (Google/GitHub/Anon)   │     │              │
│   SaveManager    │     └────────────────────────┘     │ /users/{uid} │
│   CloudSync      │──────────────────────────────────►│ /campaigns/  │
│   ProfileService │──────────────────────────────────►│ /leaderboard │
└─────────────────┘                                     └──────────────┘
```

**Data Model:**

```typescript
// Firestore: /users/{uid}
interface UserProfile {
  uid: string;
  displayName: string;
  avatarUrl?: string;
  provider: "anonymous" | "google" | "github";
  createdAt: Timestamp;
  lastSeenAt: Timestamp;
  stats: {
    totalCampaigns: number;
    totalMissions: number;
    totalVictories: number;
    totalDefeats: number;
    bestDifficulty: CampaignDifficulty;
    totalPlayTimeMs: number;
  };
  preferences: {
    theme: string;
    unitStyle: UnitStyle;
    cloudSyncEnabled: boolean;
  };
}
```

**Implementation Notes:**

- `UserProfile` lives in a Firestore `/users/{uid}` collection, separate from `/campaigns`
- Add `ProfileService` that wraps `CloudSyncService` for user-specific CRUD
- `MetaManager.getStats()` currently stores global stats in localStorage. Migrate to Firestore `/users/{uid}` for persistence across devices
- Account linking flow already works (anonymous → Google/GitHub via `linkWithPopup`). Add UI in `SettingsScreen` for explicit account management
- Add `ProfileBanner` component showing user avatar, display name, and sync status

**Firestore Rules Update:**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /campaigns/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    match /leaderboard/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

### Phase 3: Leaderboards and Social (Long-term, 2-3 months)

**Goal:** Competitive engagement and community features.

**Leaderboard System:**

```typescript
// Firestore: /leaderboard/{campaignId}
interface LeaderboardEntry {
  userId: string;
  displayName: string;
  score: number;          // Composite: missions × difficulty × efficiency
  difficulty: CampaignDifficulty;
  sector: number;
  totalMissions: number;
  soldiersLost: number;
  completedAt: Timestamp;
}
```

**Features:**

- Global leaderboard for completed campaigns
- Per-difficulty rankings
- Weekly/monthly challenge seeds (shared seed → deterministic comparisons)
- "Ghost runs" — compare mission statistics against other players' same-seed runs

**Challenge Seed System:**

The deterministic engine makes this uniquely viable:

```typescript
interface WeeklyChallenge {
  id: string;
  seed: number;
  mapConfig: MapGenerationConfig;
  squadConfig: SquadConfig;
  difficulty: CampaignDifficulty;
  startsAt: Timestamp;
  endsAt: Timestamp;
}
```

All players use the same seed → identical maps → comparable results. The existing replay system provides verification (command log replay confirms the score).

______________________________________________________________________

## 2. Multiplayer Direction

### Assessment

The architecture is **exceptionally well-positioned** for multiplayer due to:

- Deterministic simulation (seed + commands = identical state)
- Command pattern (all mutations are serializable `Command` objects)
- Web Worker isolation (engine has no DOM dependencies)
- Replay system (command log already recorded)

### Phase 1: Async Co-op (Medium-term, 2-3 months)

**Concept:** Shared campaigns where players take turns running missions. Not real-time.

```
Player A runs Mission 1 → Saves campaign state → Cloud sync
                                                      ↓
Player B loads shared campaign → Runs Mission 2 → Saves → Cloud sync
```

**Implementation:**

- Add `campaignAccessList: string[]` to campaign documents (list of authorized user UIDs)
- Implement Firestore transaction-based locking to prevent concurrent mission runs
- Add "invite player" flow using shareable campaign links
- No changes to the engine — it's already deterministic and state-serializable

### Phase 2: Real-time Spectating (Long-term, 3-6 months)

**Concept:** Watch another player's mission in real-time.

```
Active Player                          Spectator
     │                                      │
     │  ── command stream via WebRTC ──►    │
     │  ◄── no commands (view only)    ──   │
     │                                      │
  CoreEngine                          CoreEngine
  (authoritative)                    (mirror, same seed)
```

**Architecture:**

- Active player streams `Command` objects via WebRTC data channel
- Spectator runs identical `CoreEngine` with same seed/map, applying commands as they arrive
- Determinism guarantees state convergence without sending full state
- Latency = command transmission time only (spectator sees ~100-200ms delay)

**Prerequisite:** Signaling server (Firebase Realtime Database or a lightweight WebSocket relay).

### Phase 3: Competitive Multiplayer (Long-term, 6+ months)

**Concept:** Two players on the same map — one controls soldiers, one controls enemies (asymmetric multiplayer).

This would require:

- Server-authoritative engine (move `CoreEngine` to a Node.js backend or Cloudflare Worker)
- Input validation (prevent invalid commands)
- Rollback/prediction for latency compensation (or accept turn-based timing)

**Recommendation:** Only pursue if async co-op validates player demand. The architecture supports it but the scope is significant.

______________________________________________________________________

## 3. Engine Architecture Evolution

### 3.1 Extract ItemEffectService from Director

**Priority:** High (near-term)

`Director.handleUseItem()` is 100 lines of item logic (heal, grenade, scanner, mine, sentry) that violates SRP. Extract to:

```typescript
interface ItemEffectHandler {
  handleUseItem(state: GameState, cmd: UseItemCommand): void;
}

class ItemEffectService implements ItemEffectHandler {
  handleUseItem(state: GameState, cmd: UseItemCommand): void {
    // All item logic here
  }
}
```

`Director` delegates to `ItemEffectService` instead of owning the logic. The `ItemEffectHandler` interface already exists — just needs a standalone implementation.

### 3.2 Unify Entity Movement

**Priority:** Medium (near-term)

`EnemyManager` has its own inline movement code that duplicates `MovementManager.handleMovement()`. Generalize:

```typescript
class MovementManager {
  // Already handles units; add generic entity support:
  handleEntityMovement(entity: { pos: Vector2; targetPos?: Vector2; path?: Vector2[]; stats: { speed: number } }, dt: number, doors: Map<string, Door>): typeof entity;
}
```

### 3.3 Plugin Architecture for Managers

**Priority:** Low (long-term)

Currently, adding a new manager requires modifying `CoreEngine`'s constructor and `simulationStep()`. A plugin system would make this extensible:

```typescript
interface SimulationPlugin {
  readonly phase: "pre-update" | "update" | "post-update";
  readonly order: number;
  init(state: GameState, grid: GameGrid): void;
  update(state: GameState, dt: number): void;
}

class CoreEngine {
  private plugins: SimulationPlugin[] = [];

  registerPlugin(plugin: SimulationPlugin): void { ... }

  simulationStep(dt: number): void {
    for (const plugin of this.sortedPlugins) {
      plugin.update(this.state, dt);
    }
  }
}
```

This would enable modding support and cleaner separation of optional features (turrets, mines, etc.).

### 3.4 Error Boundary in CoreEngine

**Priority:** Medium (near-term)

Any sub-system exception currently propagates uncaught to the web worker, silently killing the simulation. Add a try-catch in `simulationStep()`:

```typescript
simulationStep(dt: number): void {
  try {
    // ... existing pipeline
  } catch (error) {
    Logger.error("CoreEngine: simulation error", error);
    this.state.status = "Error";
    // Post error state to main thread for UI feedback
  }
}
```

______________________________________________________________________

## 4. Content System Expansion

### 4.1 Data-Driven Content Pipeline

**Current:** Content (events, tiles, archetypes, items) is hard-coded in TypeScript files.

**Proposed:** Move to JSON files with Zod validation:

```
content/
├── events/
│   ├── campaign_events.json
│   └── schema.ts           # CampaignEventSchema
├── tiles/
│   ├── space_hulk.json
│   └── schema.ts           # TileDefinitionSchema
├── archetypes/
│   ├── soldiers.json
│   ├── enemies.json
│   └── schema.ts
├── items/
│   ├── weapons.json
│   ├── consumables.json
│   └── schema.ts
└── loader.ts               # Validates all content at startup
```

**Benefits:**

- Content creators don't need TypeScript knowledge
- Runtime validation catches bad data
- Content can be A/B tested or loaded dynamically
- Enables future modding support

### 4.2 Campaign Event System Expansion

**Current:** 3 events. Need 20+ for meaningful variety.

**Categories to add:**

| Category | Examples |
| --- | --- |
| Crew Events | Injury recovery, morale disputes, training opportunities |
| Supply Events | Arms dealer, salvage discovery, supply shortage |
| Intel Events | Enemy intel, map data, ally contact |
| Hazard Events | Hull breach, radiation zone, power failure |
| Story Events | Distress signal, survivor discovery, enemy communication |

**Event System Architecture:**

```typescript
interface CampaignEvent {
  id: string;
  category: EventCategory;
  weight: number;                // Selection probability
  conditions: EventCondition[];  // When this event can trigger
  choices: EventChoice[];
  narrative: {
    title: string;
    description: string;
    image?: string;
  };
}

interface EventCondition {
  type: "sector_min" | "sector_max" | "roster_size" | "scrap_min" | "has_item" | "difficulty";
  value: number | string;
}
```

### 4.3 New Mission Types

| Mission Type | Description | Mechanics |
| --- | --- | --- |
| Defense | Hold position against waves | Static spawn points, timer-based |
| Sabotage | Destroy multiple targets | Multi-objective, stealth bonus |
| Rescue | Find and extract survivors | Time pressure, fog-heavy maps |
| Ambush | Start surrounded, fight out | High initial threat, no spawn escalation |
| Stealth | Complete without detection | New "alert" mechanic, detection radius |

### 4.4 New Enemy Types

| Enemy | Behavior | Counter |
| --- | --- | --- |
| Spore Carrier | Explodes on death, spawns swarmers | Ranged focus fire |
| Stalker | Invisible until attacking | Scanner items, overwatch |
| Brood Mother | Spawns minions periodically | Priority target |
| Shielder | Absorbs damage for nearby allies | Flanking, grenades |
| Tunneler | Bypasses walls, appears behind lines | Rear guard, mines |

______________________________________________________________________

## 5. Rendering and UI Evolution

### 5.1 Framework Evaluation (Revisited)

**Current Decision (ADR-0029, ADR-0051):** Vanilla TypeScript with custom JSX factory.

**Recommendation:** **Maintain for game UI, evaluate SolidJS for menus.**

| Component | Approach | Rationale |
| --- | --- | --- |
| Tactical HUD | Vanilla TSX + UIBinder | Performance-critical, tight Canvas integration |
| Campaign screens | Consider SolidJS | Complex forms, nested state, many interactions |
| Settings/Profile | Consider SolidJS | Standard CRUD UI, no Canvas dependency |
| Modal system | Keep vanilla | Simple, well-implemented |

**If adopting SolidJS:**

- Hybrid approach: Canvas stays vanilla, campaign/settings screens use SolidJS
- SolidJS has no VDOM (compiles to direct DOM operations) — similar to current approach
- Bundle impact: ~7KB gzipped
- Migration path: One screen at a time, starting with `EquipmentScreen` (most complex DOM management)

### 5.2 WebGL Renderer (Long-term)

**Trigger:** When asset count or map size makes Canvas 2D a bottleneck.

**Approach:** Replace `GameRenderer` layer stack with WebGL equivalents:

```
Current:                          Future:
Canvas2D RenderLayer interface → WebGL RenderLayer interface
MapLayer.draw(ctx, state)     → MapLayer.draw(gl, state)
```

The `RenderLayer` interface is already renderer-agnostic. Each layer receives immutable `GameState` and draws independently. The transition would be layer-by-layer, not all-at-once.

**Prerequisites:**

- Sprite atlas generation (pack individual sprites into sheets)
- Tile-based batching (reduce draw calls)
- Camera system upgrade (GPU-accelerated zoom/pan)

### 5.3 Sound System

**Current:** No audio.

**Proposed Architecture:**

```typescript
interface SoundManager {
  playEffect(effect: SoundEffect, position?: Vector2): void;
  playMusic(track: MusicTrack): void;
  setVolume(channel: "effects" | "music" | "ambient", volume: number): void;
}

enum SoundEffect {
  WeaponFire, WeaponHit, DoorOpen, DoorClose,
  UnitDeath, EnemyDeath, ObjectiveComplete,
  Explosion, Heal, Alert, Extract,
}
```

**Implementation:**

- Web Audio API for spatial audio (positional effects based on camera)
- Howler.js or Tone.js for cross-browser compatibility
- Music system: ambient tracks per mission phase (exploration → combat → extraction)
- Sound events emitted from engine via existing `EVENT` worker message type

______________________________________________________________________

## 6. Testing and Quality

### 6.1 Add Tests to CI Pipeline

**Priority:** Critical (immediate)

The deploy pipeline (`deploy.yml`) runs `tsc && vite build` but **never runs tests**. Add:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run lint

  build:
    needs: test
    # ... existing build job
```

### 6.2 Coverage Enforcement

Add coverage thresholds to `vitest.config.ts`:

```typescript
test: {
  coverage: {
    provider: 'v8',
    thresholds: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    },
    include: ['src/**/*.ts'],
    exclude: ['src/**/*.test.ts', 'src/harness/**'],
  },
}
```

### 6.3 ESLint Integration

Add ESLint with `@typescript-eslint/recommended` for catching issues `tsc` misses:

- Unused imports
- Consistent return types
- No floating promises
- Naming conventions
- No `console.log` in production code

### 6.4 Balance Testing Framework

Expand `BalanceSimulator` into a proper test framework:

```typescript
interface BalanceScenario {
  name: string;
  seed: number;                    // Reproducible
  mapConfig: MapGenerationConfig;
  squadConfig: SquadConfig;
  difficulty: CampaignDifficulty;
  expectedWinRate: [number, number]; // [min, max] acceptable range
}

// Run as part of CI (slower suite, nightly or on-demand)
describe("Balance Scenarios", () => {
  for (const scenario of balanceScenarios) {
    it(`${scenario.name} has acceptable win rate`, () => {
      const results = runBalanceSimulation(scenario, 100);
      expect(results.winRate).toBeGreaterThan(scenario.expectedWinRate[0]);
      expect(results.winRate).toBeLessThan(scenario.expectedWinRate[1]);
    });
  }
});
```

______________________________________________________________________

## 7. Developer Experience

### 7.1 Replace Gemini CLI Dependency

**Priority:** Medium

`@google/gemini-cli` is installed from GitHub directly (`github:google-gemini/gemini-cli`), bypassing the npm registry. This makes builds non-reproducible without a lockfile and introduces an unpinned dependency.

**Options:**

- Move to published npm package when available
- Pin to a specific commit hash: `github:google-gemini/gemini-cli#abc1234`
- Move to devDependencies or optional dependencies
- Remove entirely if only used for scripting

### 7.2 Hot Reload for Worker

**Current:** Changes to engine code require full page reload (Web Worker is bundled separately).

**Proposed:** Use Vite's `import.meta.hot` for worker HMR. When engine files change, terminate the current worker, create a new one, and replay the command log to restore state. The deterministic engine makes this possible.

### 7.3 Debug Tools

**Proposed additions:**

- **State Inspector:** Overlay showing current `GameState` properties, selectable per-unit
- **Command Log Viewer:** Real-time display of commands sent to the engine
- **AI Decision Debugger:** Visualize behavior priority evaluation for selected unit
- **Pathfinding Visualizer:** Show A\* search area and final path
- **Performance Monitor:** Frame time, tick time, entity count, memory usage

______________________________________________________________________

## 8. Platform Expansion

### 8.1 Desktop (Electron/Tauri)

**Viability:** High. The codebase is vanilla TypeScript with no Node.js server dependencies. Wrapping in Electron or Tauri would require minimal changes.

**Benefits:**

- Offline play without browser limitations
- System tray notifications for async multiplayer
- Local file system save (in addition to cloud)
- Steam distribution

**Tauri recommended** over Electron for smaller bundle size and Rust-based security.

### 8.2 Mobile (PWA)

**Current state:** `InputManager` already handles touch events with drag-and-drop deployment. ADR-0038 documents the mobile interaction strategy.

**Remaining work:**

- Responsive canvas scaling for small screens
- Touch-friendly command menu (larger hit targets)
- PWA manifest and service worker for offline play
- Mobile-specific HUD layout (bottom-anchored controls)

### 8.3 Accessibility

**Proposed:**

- Keyboard-only navigation (partially exists via `InputDispatcher` focus stack)
- Screen reader support for campaign screens (ARIA attributes on DOM elements)
- Colorblind modes (theme variants with distinguishable palettes)
- Configurable text size
- High contrast mode for tactical overlay

______________________________________________________________________

## 9. Roadmap Summary

### Near-term (1-3 months)

| Item | Effort | Impact |
| --- | --- | --- |
| Add tests to CI | 1h | Critical — prevent regressions |
| Fix cloud sync race condition | 4h | High — data reliability |
| Upgrade Firebase persistence API | 2h | Medium — future-proofing |
| Extract ItemEffectService | 4h | High — code quality |
| Unify entity movement | 4h | Medium — DRY |
| Expand campaign events to 20+ | 1-2w | High — content depth |
| Sound system (basic effects) | 1w | High — player experience |

### Medium-term (3-6 months)

| Item | Effort | Impact |
| --- | --- | --- |
| User profiles and preferences | 2-3w | High — engagement |
| Leaderboards | 1-2w | Medium — retention |
| Weekly challenge seeds | 1w | Medium — competitive engagement |
| 2-3 new mission types | 2-3w | High — content variety |
| 3-5 new enemy types | 2-3w | High — tactical depth |
| Data-driven content pipeline | 1-2w | High — content scalability |
| PWA support | 1w | Medium — mobile reach |
| Async co-op | 2-3w | High — social engagement |

### Long-term (6-12 months)

| Item | Effort | Impact |
| --- | --- | --- |
| Real-time spectating | 1-2m | Medium — social |
| WebGL renderer | 1-2m | Medium — visual quality |
| Desktop (Tauri) | 2-3w | Medium — distribution |
| Plugin architecture | 1m | Medium — extensibility |
| Modding support | 2-3m | High — community |
| Competitive multiplayer | 3-6m | High — if demand exists |

______________________________________________________________________

## 10. Technology Recommendations

### Keep

| Technology | Rationale |
| --- | --- |
| TypeScript 5.9 (strict) | Excellent DX, type safety |
| Vite 7 | Fast builds, excellent HMR |
| Vitest 3 | Fast tests, native TS support |
| Canvas 2D | Sufficient for current art style |
| Web Workers | Determinism, responsive UI |
| Firebase Auth | Established, anonymous+linking works well |
| Zod 4 | Runtime validation, schema-first types |

### Add When Needed

| Technology | When | Why |
| --- | --- | --- |
| ESLint + `@typescript-eslint` | Immediate | Catches issues `tsc` misses |
| SolidJS | When adding complex campaign UI | No VDOM, compiles to DOM ops |
| Howler.js | When adding sound | Cross-browser audio |
| Tauri | When targeting desktop | Smaller than Electron |
| WebRTC | When adding spectating/multiplayer | P2P data channels |
| WebGL (via PixiJS or raw) | When Canvas 2D is a bottleneck | GPU-accelerated rendering |

### Avoid

| Technology | Why |
| --- | --- |
| React/Vue for game UI | VDOM overhead not justified for Canvas-integrated UI |
| Redux/MobX | Current state management is sufficient |
| GraphQL | REST/Firestore queries are simpler for this use case |
| Server-side rendering | Game is fully client-rendered |
| Microservices backend | Firebase handles all current server needs |
