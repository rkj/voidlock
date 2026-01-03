# src/harness

This directory contains tools and infrastructure for testing the game engine with automated agents (bots) and for performing balance simulations.

## Files

- `BalanceSimulator.ts`: A tool to run many automated games in the background to collect statistics on win rates and casualties for balancing purposes.
- `Bot.ts`: Defines the base interface and logic for automated agents that can play the game via the JSON protocol.
- `BotHarness.ts`: A harness to run a bot against a `CoreEngine` instance.
- `SimpleBot.ts`: A basic implementation of a bot that makes simple tactical decisions.

## Functionality

- **Agent Testing**: Allows testing the game simulation without a human player.
- **Balancing**: Facilitates large-scale simulations to tune game parameters (enemy health, weapon damage, spawn rates).

## Subdirectories

- `tests/`: Tests for the harness and bots.

## Connections

- Uses `src/engine/CoreEngine.ts` to run the simulation.
- Communicates with the engine using the same protocol as the `GameClient`.

## Related ADRs

- [ADR 0006: Autonomous Agent Architecture](../../docs/adr/0006-autonomous-agent-architecture.md)
- [ADR 0007: Command Pattern & Queue](../../docs/adr/0007-command-pattern-queue.md)
