# src/engine/tests/commands

Tests for command handling, including target selection, engagement policies, and timed actions like extraction or collection.

## Files

- `AttackTarget.test.ts`: Verifies manual attack commands on specific enemies.
- `Grenade.test.ts`: Tests Frag Grenade targeting and cell-specific damage (regression for voidlock-4rxw).
- `SetEngagement.test.ts`: Tests engagement policy changes.
- `StopCommand.test.ts`: Verifies unit stop command and state transitions.
- `TimedActions.test.ts`: Tests actions with durations (Extract, Collect, Pickup).

## Related ADRs

- [ADR 0007: Command Pattern & Queue](../../../../docs/adr/0007-command-pattern-queue.md)
