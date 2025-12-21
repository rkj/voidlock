# Track Plan: Project Foundation & Audit

## Phase 1: Audit & Documentation
- [ ] Task: Generate global test coverage report (`npx vitest run --coverage`)
- [ ] Task: Document Engine-Renderer communication protocol in `ARCHITECTURE.md`
- [ ] Task: Document the deterministic tick loop and PRNG usage in `ARCHITECTURE.md`
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Audit & Documentation' (Protocol in workflow.md)

## Phase 2: Coverage Gap Filling
- [ ] Task: Increase test coverage for `src/engine/GameGrid.ts` to 100%
- [ ] Task: Increase test coverage for `src/engine/Pathfinder.ts` to 100%
- [ ] Task: Increase test coverage for `src/engine/LineOfSight.ts` to 100%
- [ ] Task: Ensure `src/shared/PRNG.ts` is fully tested for determinism
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Coverage Gap Filling' (Protocol in workflow.md)

## Phase 3: Final Baseline
- [ ] Task: Run full test suite and verify global coverage >80%
- [ ] Task: Perform final documentation review and cleanup
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Final Baseline' (Protocol in workflow.md)
