# ADR 0003: Campaign System Architecture

**Status:** Proposed

## Context

Xenopurge is evolving from a single-mission tactical game into a persistent roguelite experience. This requires an architecture that supports:

1.  **Persistent State:** Data that lives across multiple tactical missions (Squad roster, Scrap, Map progress).
2.  **Strategic Layer:** New gameplay modes like the "Sector Map" (Bridge) and "Barracks" (Squad Management).
3.  **Simulation Parity:** The ability to run full campaigns in a headless environment for balance testing.

## Proposed Architecture

### 1. Components & Relationships

#### CampaignManager

The central orchestrator for the strategic layer.

- **Location:** `src/engine/managers/CampaignManager.ts`
- **Ownership:** Lives within the "Engine" domain to ensure accessibility for both the Renderer and headless harnesses.
- **Responsibilities:**
  - Managing `CampaignState` (CRUD operations).
  - Handling node-to-node progression logic.
  - Calculating mission rewards and applying casualties.
  - Orchestrating persistence via a `StorageProvider`.

#### GameClient (Campaign Extension)

The `GameClient` continues to be the primary bridge. In Campaign Mode:

- It initializes the `CoreEngine` using parameters provided by `CampaignManager`.
- It monitors the `GameState` for mission completion and relays `MissionResults` back to the `CampaignManager`.

#### ScreenManager (Renderer)

Handles the UI transitions between the new strategic screens:

- `ScreenBridge`: Displays the branching Sector Map.
- `ScreenBarracks`: Interface for managing soldiers and equipment.
- `ScreenDebrief`: Shows mission outcomes and XP gains.
- `ScreenMission`: The existing tactical combat view.

#### StorageProvider

A simple interface for persistence.

- `save(key: string, data: any): void`
- `load(key: string): any`
- **Implementations:** `LocalStorageProvider` (Web), `FileStorageProvider` (Node/Testing).

### 2. Data Structures (JSON Schema)

#### `CampaignState`

The root object for a campaign run.

```typescript
interface CampaignState {
  version: string;
  seed: number;
  rules: GameRules;
  scrap: number;
  intel: number;
  currentSector: number;
  currentNodeId: string | null;
  nodes: CampaignNode[];
  roster: CampaignSoldier[];
  history: MissionReport[];
}
```

#### `GameRules` (Difficulty Settings)

```typescript
interface GameRules {
  mode: "Custom" | "Preset";
  deathRule: "Iron" | "Clone" | "Simulation";
  difficultyScaling: number; // Multiplier for enemy density/stats
  resourceScarcity: number; // Multiplier for scrap rewards
}
```

#### `CampaignSoldier` (Persistent Unit)

```typescript
interface CampaignSoldier {
  id: string;
  name: string;
  archetypeId: string;
  hp: number;
  maxHp: number;
  xp: number;
  level: number;
  status: "Healthy" | "Wounded" | "Dead";
  equipment: EquipmentState;
}
```

#### `CampaignNode`

```typescript
interface CampaignNode {
  id: string;
  type: "Combat" | "Elite" | "Shop" | "Event" | "Boss";
  status: "Hidden" | "Revealed" | "Accessible" | "Cleared";
  difficulty: number;
  mapSeed: number;
  connections: string[];
  position: { x: number; y: number };
}
```

### 3. Workflow

1.  **Initialization:** `CampaignManager.start(rules, seed)` generates the initial `CampaignState`.
2.  **Navigation:** Player selects an "Accessible" node on the Bridge.
3.  **Deployment:**
    - Player selects soldiers from the `roster` in the Barracks.
    - `CampaignManager` assembles `MissionParams`.
    - `GameClient.init(MissionParams)` is called.
4.  **Tactical Phase:** Standard `CoreEngine` loop runs.
5.  **Reconciliation:**
    - On mission end, `MissionResults` are sent to `CampaignManager.completeMission()`.
    - Soldiers gain XP, casualties are marked as "Dead" or "Wounded" based on `GameRules`.
    - `CampaignState` is updated and persisted.
    - New nodes are set to "Accessible".

## Consequences

### Pros

- **Separation of Concerns:** Tactical simulation remains "pure" and unaware of the larger campaign.
- **Testability:** The entire campaign flow (progression, economy) can be unit-tested without a browser.
- **Flexibility:** Different `StorageProvider` implementations allow the game to run on various platforms.

### Cons

- **State Duplication:** Some data (like `SquadConfig`) is transformed from `Soldier[]` to `Unit[]`. This mapping must be carefully maintained.
- **Worker Complexity:** If `CampaignManager` resides in a Web Worker, all UI updates must go through asynchronous message passing.
