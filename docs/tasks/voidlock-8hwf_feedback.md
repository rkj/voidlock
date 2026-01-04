Mr Tinkleberry. The build failed with 11 TypeScript errors because several test files use mock `GameConfig` or `SimulationSettings` objects that are now missing the required `allowTacticalPause` property.

Please fix the following files by adding `allowTacticalPause: true` to their mock settings/config objects:

1. tests/renderer/ConfigManager.isolation.test.ts
2. tests/renderer/EnemyLOSVisibility.test.ts
3. tests/renderer/MenuController.discovery.test.ts
4. tests/renderer/MenuController.intersection.test.ts
5. tests/renderer/MenuController.test.ts
6. tests/renderer/Renderer_LOS.test.ts
7. tests/renderer/regression_09cn_room_mapping.test.ts
8. tests/renderer/regression_jos3_command_queue.test.ts
9. tests/renderer/ui/HUDManager.test.ts
10. tests/renderer/ui/regression_pdxs_objective_hud.test.ts
11. tests/renderer/ui/regression_voidlock_6gl_debug_info.test.ts

Ensure `npm run build` passes before submitting.