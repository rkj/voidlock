# ADR 0007: Command Pattern & Queue

**Status:** Proposed

## Context

To achieve high-fidelity determinism and support both player-driven and AI-driven control, Voidlock requires a unified interaction model. The engine runs in a separate Web Worker, necessitating a robust message-passing protocol that can be recorded, replayed, and validated.

## Solution

We implement a strict **Command Pattern** where all state-mutating interactions are encapsulated as JSON objects. These commands are processed by a **Command Queue** system within the engine.

### 1. Strict JSON Protocol

Every interaction—whether from the UI, a scripted sequence, or an autonomous bot—must be expressed as a `Command`.

- **Encapsulation**: Commands contain all data required for execution (e.g., `unitIds`, `target` coordinates, `itemId`).
- **Serializability**: Being plain JSON, commands are easily logged to a `CommandLog` for replays.
- **Type Safety**: TypeScript discriminated unions (via `CommandType` and `Command` types) ensure the engine and client agree on the payload structure.

### 2. Command Queueing System

Each unit maintains its own `commandQueue`.

- **Atomic Execution**: The engine processes the `activeCommand`. When complete (e.g., unit reaches destination), it pulls the next command from the queue.
- **Interrupts vs. Appends**:
  - By default, issuing a new command clears the current queue (Interrupt).
  - If the `queue` flag is set to `true` (e.g., when holding `Shift` in the UI), the command is appended to the end of the queue.
- **Immediate Commands**: Some commands (like `STOP` or `SET_ENGAGEMENT`) may trigger immediate state changes while clearing or modifying the queue.

### 3. Determinism & Tick Synchronization

Commands are not executed immediately upon receipt. Instead, they are stamped with the current simulation tick.

- **Tick-stamping**: When a command reaches the engine, it is queued to be processed at the start of the next simulation tick.
- **Order of Operations**:
  1. Collect incoming commands from the message port.
  1. Append/Replace unit queues based on command flags.
  1. Update unit states based on the `activeCommand`.
  1. Resolve simulation logic (Movement, Combat, LOS).
- **Replayability**: By recording the `(Tick, Command)` pairs, the exact state of the game can be reconstructed if the initial `Seed` and `MapDefinition` are known.

### 4. Shared Protocol Definition

The `Command` types are defined in `src/shared/types.ts`, serving as the single source of truth for both the `engine` (Worker) and the `renderer` (Main Thread).

## Design Principles

- **Unidirectionality**: Commands flow from Client to Engine; State Updates flow from Engine to Client.
- **Validation**: The engine validates commands (e.g., "Is this unit still alive?" or "Is this door reachable?") before execution.
- **Asynchronicity**: The UI remains responsive while the engine processes commands at its own pace.

## References

- [Command System Specification](../../spec/commands.md)
- [Simulation & Protocol Specification](../../spec/simulation.md)
- `src/shared/types.ts`: `Command` and `CommandType` definitions.
- `src/engine/CoreEngine.ts`: Command processing loop.
