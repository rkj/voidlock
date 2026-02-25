# ADR 0049: Guided Progressive Disclosure for the Prologue

## Status

Proposed

## Context

New players are overwhelmed by the complexity of the Mission Setup and Campaign Bridge screens. The current Prologue (ADR 0042) focused on in-mission guidance but left the pre-mission flow untouched, leading to confusion where players "Confirm" a squad but don't know how to "Launch" the mission.

## Decision

We will implement a strictly guided flow for the Prologue mission that enforces progressive disclosure of game systems.

### 1. The "Lockdown" State

When `MissionType.Prologue` is active, the following UI restrictions apply:

- **Sector Map:** Hidden. The campaign starts directly in the Ready Room (Equipment Screen).
- **Mission Setup:** Hidden. All map/enemy parameters are fixed for the Prologue.
- **Squad Selection:** Restricted. The squad is pre-populated with 1-2 soldiers (e.g., a "Scout"). The player cannot add or remove members.
- **Equipment Store:** Locked. Players cannot buy or swap gear during the Prologue.
- **Navigation:** Tabs for "Engineering", "Statistics", and "Settings" are hidden or disabled within the Campaign Shell.

### 2. The "Bridge-to-Tactical" Bridge

- **Launch-First Flow:** On the Equipment Screen, the primary action button for the Prologue will be "Launch Mission" instead of "Confirm Squad". This eliminates the redundant trip back to the Sector Map.
- **Narrative Intro:** Before the mission starts (on the Launch button click or during the Mission Setup screen), a "Mother" Advisor overlay will present a narrative backstory and mission objective using a blocking modal with an illustration.

### 3. Progressive Unlocking

Complexity is restored sequentially after the Prologue:

- **Mission 2:** Unlocks the Sector Map and basic Squad Selection.
- **Mission 3:** Unlocks the Equipment Store and basic Mission Setup (Map Size).
- **Mission 5+:** Unlocks Advanced Mission Setup (Threat, Wave Scaling) and Engineering.

## Consequences

- **UX Consistency:** Players are guided through a single path until they understand the core "Tactical Loop".
- **Implementation:** Requires updates to `NavigationOrchestrator`, `EquipmentScreen`, and `CampaignShell` to respect the "Prologue Lockdown" state.
- **Narrative Assets:** Requires a few static illustrations for the narrative beats.
