# ADR 0030: Split-Pane Debrief Screen with Integrated Replay

**Status:** Proposed
**Replaces:** None (Augments ADR 0004)

## Context

ADR 0004 established the requirement for a mission replay to play in the "background" of the Debrief Screen. However, the current implementation (verified via US_008 and VUI screenshots) lacks visual focus, as mission statistics and squad results obscure the replay. Furthermore, there are no user controls to pause or adjust the speed of the playback, limiting the utility of the feature for tactical review.

## Proposed Changes

### 1. Split-Pane UI Layout
The `DebriefScreen` will be refactored from a full-screen overlay to a composite split-pane view:
- **MissionSummary (Left Pane, ~40% width)**: A scrollable, DOM-based component rendering the mission statistics (Kills, Time, Scrap) and the Squad After-Action Report (Names, XP bars, Status).
- **ReplayViewport (Right Pane, ~60% width)**: A dedicated area containing:
    - **ReplayCanvas**: A secondary HTML5 Canvas managed by a dedicated `ReplayRenderer`.
    - **Playback Control Bar**: A themed UI strip at the bottom of the viewport.

### 2. Playback Controls
The control bar will provide the following interactions:
- **Play/Pause Toggle**: Resumes or halts the replay simulation.
- **Speed Selector**: Preset buttons for `1x`, `2x`, `5x`, and `10x` playback speeds.
- **Progress Indicator**: A visual bar showing current replay progress.

### 3. Component Architecture
- **`ReplayController`**: A new class to manage the lifecycle of the `Replay` mode engine instance. It will handle the initialization via `GameClient` and ensure cleanup when the user exits the Debrief screen.
- **Encapsulation**: The replay logic will be isolated from the primary game state to prevent "Premature failure" glitches (as seen in `voidlock-9uzl`) where the simulation continues running in the background of the UI.

## Consequences

### Pros
- **Improved Clarity**: Mission results and tactical playback are clearly separated.
- **User Agency**: Players can control the pace of their tactical review.
- **Robustness**: Encapsulating the replay logic prevents UI state contamination.

### Cons
- **Performance**: Maintaining a second canvas and simulation instance (even if sequential) requires careful memory management.
- **Complexity**: Refactoring the CSS and DOM structure of the Debrief screen.

## References
- [ADR 0004: Mission Replay & Debrief](./0004-mission-replay-and-debrief.md)
- [Spec: UI Layout Reorganization](./../spec/ui.md#8.4.1)
