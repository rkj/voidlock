# Task Context: xenopurge-gemini-0rdj

## Objective
Implement the "Barracks" and "Roster Management" UI for the Campaign Mode. This interface allows the player to manage their persistent roster of soldiers between missions.

## Requirements

### 1. Engine Logic (`src/engine/managers/CampaignManager.ts`)
Add the following methods to `CampaignManager`:
- `recruitSoldier(archetypeId: string, name: string): void`:
  - Cost: 100 Scrap.
  - Adds a new `CampaignSoldier` to `state.roster`.
- `healSoldier(soldierId: string): void`:
  - Cost: 50 Scrap.
  - Sets `status` to "Healthy" and restores `hp` to `maxHp`.
- `reviveSoldier(soldierId: string): void`:
  - Cost: 250 Scrap.
  - Only allowed if `state.rules.deathRule === "Clone"`.
  - Sets `status` to "Healthy" and restores `hp` to `maxHp`.
- `assignEquipment(soldierId: string, equipment: EquipmentState): void`:
  - Updates the soldier's equipment.

### 2. UI Implementation (`src/renderer/screens/BarracksScreen.ts`)
Create a new `BarracksScreen` class (mimic `CampaignScreen.ts` structure):
- **View Roster**: List all soldiers with their stats (Level, XP, HP, Aim, Kills, Status).
- **Recruit UI**: A section to buy new recruits from available archetypes.
- **Soldier Details**: When a soldier is selected, show options to:
  - Heal (if wounded).
  - Revive (if dead and allowed).
  - Change Equipment (Right Hand, Left Hand, Body, Feet). Use item dropdowns/lists.
- **Navigation**:
  - Add a "BARRACKS" button to `CampaignScreen` (replace the TODO placeholder).
  - Add a "BACK" button to return to the Sector Map.

## Verification
-   Write unit tests for the new `CampaignManager` methods in `tests/engine/managers/CampaignManager.test.ts`.
-   Verify the UI transitions and functionality in the browser.
-   Ensure the project builds and lints successfully.
