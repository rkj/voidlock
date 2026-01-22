# ADR 0013: Unified Map Generation Configuration

## Context

The current `MapGenerator` class uses a "split API" approach where the random seed is provided in the constructor, but critical parameters like `width`, `height`, and `MapGeneratorType` are passed into the `generate()` method. This leads to:

1.  Inconsistency in how generation parameters are handled.
2.  Difficulty in passing a "map recipe" or configuration object between systems (e.g., from UI to Worker).
3.  Fragile method signatures that grow with new optional parameters.

## Decision

We will refactor the `MapGenerator` to strictly adhere to a **Configuration Object Pattern**.

1.  **Interface Definition**: We will define a `MapGenerationConfig` interface in `shared/types.ts`.

    ```typescript
    export interface MapGenerationConfig {
      seed: number;
      width: number;
      height: number;
      type: MapGeneratorType;
      spawnPointCount?: number; // Optional, defaults to 1
    }
    ```

2.  **Constructor Injection**: The `MapGenerator` class will accept this configuration in its constructor.

    ```typescript
    export class MapGenerator {
      private config: MapGenerationConfig;

      constructor(config: MapGenerationConfig) {
        this.config = config;
        this.prng = new PRNG(config.seed);
        // ...
      }

      public generate(): MapDefinition {
        // Use this.config...
      }
    }
    ```

3.  **Immutability**: The configuration is considered immutable for the lifespan of that `MapGenerator` instance. To generate a different map, instantiate a new generator.

## Consequences

- **Refactoring Cost**: Requires updating `GameClient` and approximately 30 test files.
- **Clarity**: Code becomes more self-documenting (`new MapGenerator({ width: 16, ... })` vs `new MapGenerator(123).generate(16, ...)`).
- **Portability**: The `MapGenerationConfig` object can be easily serialized/deserialized for network transmission or saving "New Game" presets.
