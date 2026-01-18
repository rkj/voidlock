# ADR 0020: Refactor CampaignScreen (Split Wizard)

## Status
Accepted

## Context
The `src/renderer/screens/CampaignScreen.ts` file currently handles two distinct responsibilities:
1. Displaying the active sector map and handling node navigation.
2. Rendering and managing the "New Campaign" wizard (difficulty selection, advanced options).

This violates the Single Responsibility Principle (SRP). The file is large (~670 lines) and difficult to maintain. Changes to the setup flow risk breaking the map view, and vice versa.

## Decision
We will extract the "New Campaign" wizard logic into a separate component.

### Changes
1.  **Create `src/renderer/screens/campaign/NewCampaignWizard.ts`**:
    *   Move `renderNoCampaign` and all associated helper methods (difficulty cards, advanced options) here.
    *   This class will accept callbacks for `onStartCampaign` and `onBack`.
2.  **Update `CampaignScreen.ts`**:
    *   Remove the wizard logic.
    *   Instantiate `NewCampaignWizard` when no campaign state exists.
    *   Focus solely on rendering the `CampaignState` (map, HUD).

## Consequences
*   **Positive**: Smaller, more focused files. Easier to test the wizard logic in isolation. Clearer separation of "Setup" vs "Play" states.
*   **Negative**: Slight increase in file count and wiring complexity.
