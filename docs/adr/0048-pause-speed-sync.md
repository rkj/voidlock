# ADR 0048: Standardizing Pause and Speed Slider Synchronization

## Context

The current implementation of pause/unpause and speed scaling is fragmented across `UIOrchestrator`, `HUDManager`, and `GameClient`. This has resulted in:

1. **Unpause Failure**: `UIOrchestrator` incorrectly attempts to unpause by setting a time scale of `1.0` rather than calling the `GameClient.resume()` method, which is the only way to clear the internal `isPaused` flag.
1. **Slider Desynchronization**: The speed slider in the HUD is frequently desynchronized from the actual simulation speed because of incorrect ID references (`speed-slider` vs `game-speed`) and missing logarithmic mapping (setting the raw scale value to a 0-100 slider).
1. **UI Fighting**: Multiple managers are competing to update the same button labels, causing visual "blinking" when their state derived from the engine and the local client slightly differ.

## Decision

1. **Authoritative Pause**: UI components MUST use the Game Client's dedicated pause/resume methods exclusively.
1. **Pause States**:
   - **Active Pause (0.1x)**: Triggered by `Spacebar` when allowed. Standardized across engine and UI.
   - **Absolute Pause (0.0x)**: Simulation is completely halted for menus and deployment.
1. **Logarithmic Slider Mapping**: 0-100 range maps to 0.1x-10.0x scale using shared utility.
1. **UI Visibility (Progressive Disclosure)**:
   - **Hide in Deployment**: Speed/Pause controls and the Threat Meter must be hidden while in the Deployment phase.
   - **Hide in Prologue**: Speed/Pause controls are hidden for the duration of Mission 1.
   - **Conditional Threat**: The Threat Meter appears only after the first hostile contact in Mission 1.
1. **Unified ID Reference**: Standardized to `game-speed`.
1. **Authoritative UI Updates**: HUD Manager is the sole source for mission UI labels and state-driven visibility.

## Consequences

- The pause/unpause behavior will become reliable as it follows a single state-change path.
- The speed slider will accurately reflect the game's simulation speed at all times, including at mission start.
- Visual "blinking" of the play/pause button will be eliminated by removing redundant label updates in `UIOrchestrator`.
