# ADR 0016: Modular Map Generation Architecture

## Context

The `src/engine/MapGenerator.ts` file currently mixes three distinct responsibilities:

1. **Orchestration:** Selecting and instantiating the correct generator strategy based on config.
1. **Validation:** checking if a generated map meets gameplay requirements (e.g., connectivity, spawn point counts).
1. **Sanitization:** cleaning up artifacts (e.g., removing unreachable void cells, ensuring boundary consistency).

This mixing makes it difficult to unit test the validation logic in isolation and complicates the addition of new generator types.

## Decision

We will split the responsibilities of `MapGenerator.ts` into a dedicated module `src/engine/map/`.

### Components

1. **`MapFactory` (formerly `MapGenerator`):**
   - Responsible _only_ for accepting a `MapGenerationConfig` and returning a `MapDefinition`.
   - Delegates the actual generation to specific strategies (e.g., `SpaceshipGenerator`).
   - Delegates post-processing to `MapSanitizer` and `MapValidator`.

1. **`MapSanitizer`:**
   - Contains pure functions to clean up the map data.
   - Responsibilities: standardizing wall segments, culling unreachable cells (if any), ensuring consistent graph state.

1. **`MapValidator`:**
   - Contains rules for map correctness.
   - Responsibilities: Verifying connectivity (Flood Fill), checking entity placement constraints (as per ADR 0014), ensuring minimum counts (Spawns, Objectives).

## Consequences

- **Positive:**
  - **Testability:** `MapValidator` can be tested with hardcoded map fragments to verify edge cases without running the full generator.
  - **Clarity:** The generation pipeline (Generate -> Sanitize -> Validate) becomes explicit.
- **Negative:** slightly more boilerplate to wire up the factory.
