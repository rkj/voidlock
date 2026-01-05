Previous attempt timed out. The agent was investigating how to:
1) Update Grenade targeting to strictly require a visible enemy target.
2) Update Medkit targeting to allow selecting any Friendly Unit.

Progress so far:
- Checked `MenuConfig.ts` and `MenuController.ts`.
- Identified that `UseItemCommand` might need `targetUnitId`.
- Planned to create a test first.

Please continue with:
- Implementation of `FRIENDLY_UNIT` and `HOSTILE_UNIT` target modes in `MenuController.ts`.
- Ensuring Grenades use `HOSTILE_UNIT` and are disabled if no enemies are visible.
- Ensuring Medkits use `FRIENDLY_UNIT`.
- Updating the `USE_ITEM` command to support unit selection.
