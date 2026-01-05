The mission restoration logic is failing. 
Error in console: "[error] Failed to resume mission JSHandle@error"

Also, there is a sync issue in `DOMContentLoaded`:
If `persistedScreen` is NOT "mission" (e.g. "mission-setup"), the code currently does nothing, leaving the "main-menu" visible even though `screenManager.currentScreen` is set to "mission-setup".

Please:
1) Investigate why `resumeMission` is throwing an error. Check all variables being assigned from `config`.
2) Fix the `DOMContentLoaded` logic to ensure that if `persistedScreen` is present, it is actually displayed (or at least handle the `else` case properly).
3) Verify that `gameClient.init` works correctly with the restored `commandLog`.

Tip: Check if `currentCampaignNode` restoration logic is safe.
Tip: Check if `screenManager.show(persistedScreen)` should be called if it's not "mission".
