# Verification Feedback: xenopurge-gemini-0rdj

## Issues Found

### 1. Initial Roster Missing Equipment
The starting 4 soldiers in the roster have empty equipment slots. This is because `generateInitialRoster` in `src/engine/managers/CampaignManager.ts` initializes `equipment: {}`. It should instead populate it using the archetype's default equipment, similar to how `recruitSoldier` does it.

### 2. UI State Desync (Scrap/Intel)
When returning from the Barracks to the Sector Map, the Scrap and Intel values in the header do not update. For example, if you recruit a soldier (spending 100 Scrap), the Barracks shows 400, but when you click "BACK TO SECTOR MAP", the Sector Map still shows 500.
This is because `screenManager.goBack()` only toggles the CSS `display` property and does not trigger a re-render of the `CampaignScreen`.

## Instructions
1.  **Fix Engine Logic**: Update `generateInitialRoster` in `src/engine/managers/CampaignManager.ts` to correctly populate the `equipment` field for initial recruits.
2.  **Fix UI Transition**: In `src/renderer/main.ts`, update the `onBack` callback for the `BarracksScreen` to call `campaignScreen.show()` before (or instead of) `screenManager.goBack()`, or ensure the Sector Map re-renders whenever it is shown.
3.  **Verify**:
    -   Ensure initial soldiers have their default weapons.
    -   Ensure Scrap/Intel values are consistent across screens.
