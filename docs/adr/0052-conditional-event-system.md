# ADR 0052: Conditional Narrative Event System

## Status

Proposed

## Date

2026-03-05

## Context

The campaign event system currently consists of 3 hardcoded events (`CampaignEvents.ts`) with static text and a flat reward/risk/cost model. Every event can appear in every campaign regardless of squad state, progression, or history. The `EventManager` applies outcomes (scrap, intel, recruit, damage, ambush) but has no awareness of the campaign context in which the event fires.

This means:
- A first-sector campaign and a late-game campaign see the same events.
- Events never reference individual soldiers by name, despite `CampaignSoldier` tracking kills, missions, level, status, and equipment.
- Events never reference campaign history, despite `CampaignState.history` recording every mission outcome.
- Adding new events requires TypeScript code changes, not data authoring.

The existing architecture is well-positioned for extension. `CampaignEventDefinition` is already a data structure. `EventModal` is already generic — it renders any definition without hardcoded knowledge of specific events. `EventManager.applyEventChoice` is already a sequential cost→risk→reward pipeline. The campaign state tracks rich per-soldier and per-mission data that events could query.

## Decision

Extend the event system with three capabilities:

1. **Condition-based event filtering** — events declare when they're eligible to fire.
2. **Template text resolution** — event text references live campaign/soldier data.
3. **Expanded outcome effects** — richer rewards and penalties beyond scrap/intel/recruit.

All three are additive changes to existing types and the existing `EventManager` pipeline. No changes to `EventModal`, `CampaignNode`, sector map generation, or the campaign flow.

### 1. Condition-Based Event Filtering

Add an optional `conditions` field to `CampaignEventDefinition`:

```ts
interface EventConditions {
  minSector?: number;              // campaign has reached at least this sector
  maxSector?: number;              // campaign has not passed this sector
  minMissionsCompleted?: number;   // total missions in history
  maxRosterSize?: number;          // squad is small (attrition pressure)
  minRosterSize?: number;          // squad is large enough
  hasWounded?: boolean;            // at least one soldier is wounded
  hasDead?: boolean;               // at least one soldier has died this campaign
  rosterMatch?: SoldierCondition;  // at least one soldier matches
  minScrap?: number;               // can afford cost-gated events
  maxScrap?: number;               // poverty-triggered events
}

interface SoldierCondition {
  minKills?: number;
  minMissions?: number;
  minLevel?: number;
  status?: "Healthy" | "Wounded";
  archetypeId?: string;
}
```

A new `EventSelector` class evaluates all registered events against the current `CampaignState` and returns eligible candidates. The campaign flow picks one at random (via PRNG) when generating an Event node.

**Why a separate class**: Keeps `EventManager` focused on outcome application. `EventSelector` is a pure function of `(events[], state) → eligible[]`, easily unit-tested.

### 2. Template Text Resolution

Event `text` and choice `description` fields support `{{mustache}}` placeholders resolved at display time:

| Placeholder | Resolves To |
|---|---|
| `{{soldier.name}}` | Name of the soldier that matched `rosterMatch` |
| `{{soldier.kills}}` | That soldier's kill count |
| `{{soldier.missions}}` | That soldier's mission count |
| `{{soldier.archetypeId}}` | That soldier's class |
| `{{wounded.name}}` | Name of a wounded soldier (if `hasWounded`) |
| `{{campaign.scrap}}` | Current scrap |
| `{{campaign.sector}}` | Current sector number |
| `{{campaign.rosterSize}}` | Number of living soldiers |
| `{{lastMission.result}}` | "Won" or "Lost" from most recent mission |

Resolution happens in `EventManager` before passing the definition to `EventModal`. The modal remains unchanged — it receives a fully resolved `CampaignEventDefinition` with concrete strings.

**Binding strategy**: When `EventSelector` picks an event, it also returns a `bindings` map of resolved values (e.g., which specific soldier matched `rosterMatch`). `EventManager` uses this map for both text resolution and outcome targeting.

### 3. Expanded Outcome Effects

Extend `EventChoice` with new effect types:

```ts
interface EventChoice {
  // ... existing fields (label, description, cost, reward, risk)

  // New reward types
  reward?: {
    scrap?: number;
    intel?: number;
    recruit?: boolean;
    healSoldier?: "matched" | "all_wounded";  // heal the matched soldier or all
    revealNodes?: number;                      // reveal N hidden nodes on sector map
    equipmentId?: string;                      // grant a specific equipment item
    xpBonus?: { target: "matched" | "all"; amount: number };
  };

  // New penalty types (separate from risk for guaranteed penalties)
  penalty?: {
    scrap?: number;
    woundMatched?: boolean;    // wound the soldier from rosterMatch
    loseSoldier?: boolean;     // matched soldier leaves roster permanently
    lockNode?: string;         // lock a previously accessible node
  };
}
```

Each new effect type is a small addition to the existing sequential pipeline in `EventManager.applyEventChoice`. The method already handles cost→risk→reward in order; new cases slot into the same structure.

### Event Definition Example

```ts
{
  id: "veterans_doubt",
  conditions: {
    minMissionsCompleted: 4,
    rosterMatch: { minKills: 6, status: "Healthy" },
    hasWounded: true,
  },
  title: "Veteran's Doubt",
  text: "{{soldier.name}} corners you in the corridor. '{{wounded.name}} almost didn't make it back. I've killed {{soldier.kills}} of these things and the missions keep getting harder. What's the point?'",
  choices: [
    {
      label: "\"We fight for each other.\"",
      description: "Rally the veteran with a reminder of what they're protecting.",
      reward: { healSoldier: "all_wounded", xpBonus: { target: "matched", amount: 50 } },
      risk: { chance: 0.15, damage: 0.1 },
    },
    {
      label: "\"You're free to leave.\"",
      description: "Call their bluff — or lose them for good.",
      risk: { chance: 0.4 },
      penalty: { loseSoldier: true },
      reward: { scrap: 80 },
    },
    {
      label: "Say nothing.",
      description: "Some questions don't have answers.",
    },
  ],
}
```

This event only fires when the campaign has a battle-hardened soldier AND a wounded squadmate. The text names both soldiers. The choices have real mechanical weight tied to the narrative framing.

## Implementation Plan

### Phase 1: Condition Matching (~2-3 hours)

1. Add `EventConditions` and `SoldierCondition` types to `campaign_types.ts`.
2. Add optional `conditions` field to `CampaignEventDefinition`.
3. Create `EventSelector` class with `selectEligible(events, state, prng)` method.
4. Wire `EventSelector` into `CampaignManager` where Event nodes are resolved.
5. Existing 3 events get no conditions (always eligible) — backward compatible.

### Phase 2: Template Resolution (~1-2 hours)

1. Add `bindings` return value to `EventSelector.selectEligible`.
2. Add `resolveTemplates(event, bindings)` method to `EventManager`.
3. Call `resolveTemplates` before passing definition to `EventModal`.

### Phase 3: Expanded Effects (~2-3 hours)

1. Extend `EventChoice` types in `campaign_types.ts`.
2. Add cases to `EventManager.applyEventChoice` for each new effect.
3. Update `EventModal` detail rendering to display new reward/penalty types (already partially generic).

### Phase 4: Content Authoring (~ongoing)

Author 15-20 events covering:
- **Early campaign** (sectors 1-2): resource scarcity, first contact, crew bonding.
- **Mid campaign** (sectors 3-4): attrition pressure, veteran stories, hard choices.
- **Late campaign** (sectors 5+): desperation, sacrifice, turning points.
- **Conditional on roster**: class-specific events (medic dilemmas, scout reconnaissance).

## Consequences

### Positive

- **Content velocity**: New events are pure data definitions. No code changes after the system is built.
- **Narrative depth**: Events that reference your actual soldiers create emotional attachment — the core loop that makes roguelikes with permadeath compelling (cf. XCOM, Wildermyth, Rimworld).
- **Replayability**: Condition-gated events mean different campaigns surface different stories based on how the run unfolds.
- **Backward compatible**: Existing 3 events work unchanged (no conditions = always eligible).
- **Testable**: `EventSelector` is a pure function, trivially unit-tested. Template resolution is string replacement, trivially tested.

### Negative

- **Content quality burden**: The system is only as good as the events authored for it. Bad writing undermines the mechanic.
- **Balancing complexity**: More event outcomes means more variables affecting campaign balance. Events that grant equipment or remove soldiers can swing difficulty significantly.
- **Template edge cases**: Placeholder resolution must handle missing bindings gracefully (e.g., if a matched soldier dies between selection and display).

### Risks

- **Scope creep**: The temptation to add ever-more-complex condition types (chains, exclusions, cooldowns). Phase 1 should ship with the minimal condition set above and expand only when concrete events require it.
- **Event pool exhaustion**: With conditions, a specific campaign state might match zero events. The system must fall back to unconditional events or generate a generic event.

## Alternatives Considered

### LLM-Generated Event Text

Use an AI model to generate event text dynamically from campaign state. Rejected because: requires network dependency, non-deterministic (breaks replay), unpredictable tone/quality, and the condition+template approach achieves 80% of the narrative benefit with full determinism.

### Scripted Event Chains (Multi-Step Events)

Events that span multiple nodes — e.g., "rescue mission" at node 3 has consequences at node 7. Deferred to a future ADR. The current proposal is self-contained per node, which is simpler and sufficient for the initial content library.

### External Event Definition Files (JSON/YAML)

Define events in JSON files instead of TypeScript. Deferred because: TypeScript definitions get type-checking and IDE support for free, and the current `CampaignEvents.ts` pattern works well. Can be revisited if/when a modding system is introduced.
