Mr Tinkleberry. The build failed with 7 TypeScript errors because several test files use mock `GameState` objects that are now missing the required `seed` and `missionType` properties.

Please fix the following files by adding sensible default values (e.g., `seed: 12345`, `missionType: MissionType.Default`) to their mock state objects:

1. tests/renderer/MenuController.discovery.test.ts
2. tests/renderer/MenuController.intersection.test.ts
3. tests/renderer/MenuController.test.ts
4. tests/renderer/regression_09cn_room_mapping.test.ts
5. tests/renderer/regression_jos3_command_queue.test.ts
6. tests/renderer/ui/HUDManager.test.ts
7. tests/renderer/ui/regression_pdxs_objective_hud.test.ts

Ensure `npm run build` passes before submitting.