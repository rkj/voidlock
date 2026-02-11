# Agent Log Analysis (last 10)

## Instruction compliance (systematic failures)

- **0/10** sessions read `@docs/AGENTS.md` or `@docs/spec/index.md` (violates instruction #2 in every run).
- **10/10** sessions ended without the required `SUMMARY:` prefix.
- **6/10** hit “Tool execution denied by policy” and **continued** with further tool calls (violates “STOP IMMEDIATELY on permission errors”).
- **1/10** used forbidden `jj` (`voidlock-24pg.log`: `jj diff --git`).

## Token/efficiency waste

- **Huge output** from full-suite runs dominates logs:
  - `voidlock-civ2.log`: `npx vitest run` produced ~115k chars in one tool_result line.
  - `voidlock-053u.log`, `voidlock-o4u8.log`, `voidlock-8kzr.log`: `npx vitest run tests/renderer/` produced ~30–35k chars each.
- **Repeated same-test reruns** (no evidence of edits between runs):
  - `voidlock-dygm.log`: `tests/renderer/integration/E2E_CampaignLoss.test.ts` x3
  - `voidlock-5zf9.log`: `regression_i864...` x3 and x2
  - `voidlock-053u.log`: `regression_voidlock_053u_escort_targets` x4; `MenuConfig_NewCommands` x3
  - `voidlock-civ2.log`: `EnemyIndicators` x3
  - `voidlock-o4u8.log`: `grenade_targeting` x4
  - `voidlock-8kzr.log`: `extraction_discovery` x4
  - `voidlock-dibl.log`: `repro_voidlock_dibl` x2
  - `voidlock-1no8.log`: `OverwatchRehydration` x2; `regression_voidlock_1no8...` x2
- **Edit failures** cause extra cycles:
  - `voidlock-053u.log`: 2 “Failed to edit…”
  - `voidlock-civ2.log`: 1 “Failed to edit…”
  - `voidlock-dibl.log`: 2 “Failed to edit…”

## TDD adherence

- **TDD violated** (edits before first test) in **7/10** logs: `24pg`, `053u`, `civ2`, `o4u8`, `8kzr`, `dibl`, `1no8`.
- **TDD adhered** in **3/10**: `dygm`, `5zf9`, `tejf`.

## Per-log highlights (failure/cycle points)

- `voidlock-24pg.log`: used `jj` (forbidden), permission denied x3 then continued, TDD violation, lint run twice, missing `SUMMARY:`.
- `voidlock-dygm.log`: repeated same failing E2E test 3×, permission denied then continued, missing `SUMMARY:`.
- `voidlock-5zf9.log`: repeated regression tests 5 total runs, permission denied once, missing `SUMMARY:`.
- `voidlock-tejf.log`: repeated `BarracksScreen` test twice, missing `SUMMARY:`.
- `voidlock-053u.log`: full suite run (`tests/renderer/`), repeated tests (4×/3×), 2 failed edits, TDD violation, missing `SUMMARY:`.
- `voidlock-civ2.log`: full suite run (`npx vitest run`), repeated `EnemyIndicators` test 3×, permission denied then continued, failed edit, TDD violation, missing `SUMMARY:`.
- `voidlock-o4u8.log`: full suite run, repeated grenade targeting test 4×, TDD violation, missing `SUMMARY:`.
- `voidlock-8kzr.log`: full suite run, repeated extraction discovery test 4×, permission denied then continued, TDD violation, missing `SUMMARY:`.
- `voidlock-dibl.log`: failed edits x2, repeated repro test, TDD violation, missing `SUMMARY:`.
- `voidlock-1no8.log`: permission denied then continued, repeated tests, missing `SUMMARY:`.

## Recommendations (faster + fewer tokens + more correct)

1. **Hard preflight checklist**: read `@docs/AGENTS.md` + `@docs/spec/index.md` before any edits.
2. **Stop on permission error**: immediately request escalation; do not continue.
3. **Avoid full-suite runs during iteration**; use targeted test(s) until final `npx vitest run`.
4. **Retest guard**: only re-run the same test if a file edit occurred since the last run.
5. **Avoid failed edits**: read small context blocks, use apply_patch, confirm exact matches.
6. **Enforce exit format**: always end with `SUMMARY:` line.
