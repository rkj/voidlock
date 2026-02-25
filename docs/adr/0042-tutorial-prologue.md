# ADR 0042: Tutorial System - The Prologue

## Status

Accepted

## Context

New players are dropped into complex tactical situations without guidance on core mechanics like Movement, Combat, Item Usage, and Extraction. A dedicated "Tutorial Mode" separates learning from playing, while simple tooltips are easily ignored. We need an immersive, integrated onboarding experience that teaches by doing within the context of the Campaign.

## Decision

We will implement a **Prologue Mission** system combining a scripted map with a reactive "Advisor" overlay.

### 1. The Prologue Mission (Rank 0)

- **Trigger:** Automatically inserted as the first node of a new campaign if "Skip Prologue" is NOT selected.
- **Map:** A fixed, hand-crafted `MapDefinition` (JSON) designed for sequential teaching.
  - **Zone 1 (Movement):** Secure start room. Task: Move to door.
  - **Zone 2 (Combat):** Corridor with 1 weak enemy (Xeno-Mite). Task: Engage/Kill.
  - **Zone 3 (Interaction):** Locked door or debris. Task: Use interaction/item.
  - **Zone 4 (Objective):** Room with "Flight Recorder" (Intel). Task: Recover.
  - **Zone 5 (Extraction):** Final room. Task: Extract squad.
- **Rewards:** Standard Mission rewards (Scrap, XP) to kickstart the campaign economy.

### 2. The Advisor System ("MOTHER")

- **UI Component:** A non-blocking (or semi-blocking) overlay displaying character portraits and text.
- **Triggers:** The system listens to `GameState` changes or specific `Event` signals.
  - *Start:* "Commander, squad is online. Proceed to the airlock."
  - *First Move:* "Good. Movement systems nominal."
  - *Enemy Sighted:* "Hostile detected! Weapons free. Maintain effective range."
  - *Taking Damage:* "Unit taking fire! Use a Medkit from Global Supplies."
  - *Objective Sighted:* "Target located. Secure the package."
- **Persistence:** Tutorial completion state is saved globally (`voidlock_meta`). "Skip Prologue" defaults to ON after first completion.

### 3. Technical Implementation

- **`TutorialManager`:** A new controller in the Renderer that:
  - Subscribes to `GameClient` state updates.
  - Maintains internal state (`hasMoved`, `hasAttacked`, `hasHealed`).
  - Dispatches `ShowAdvisorMessage` events to the UI.
- **`AdvisorOverlay`:** A UI component rendering the messages.
  - **Style:** Sci-fi HUD overlay (Green monochrome CRT effect).
  - **Interaction:** "Dismiss" or "Continue" (if multi-part).
  - **Pause:** Critical tutorial messages should auto-pause the engine (`timeScale = 0`).

### 4. Integration

- **Campaign Generator:** If Prologue is active, `generateSectorMap` inserts a special `Node_0` fixed node before the standard generation logic.
- **Mission Manager:** Detects `MissionType.Prologue` to load the static map and enable the `TutorialManager`.

## Consequences

- **Asset Requirement:** Need a "Mother" / Advisor portrait icon.
- **Content Work:** Designing the specific static map for the Prologue.
- **Maintenance:** Tutorial logic must be updated if core mechanics change (e.g. if we remove Medkits).
