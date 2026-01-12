# src/engine/map

This directory contains the modular map generation system (ADR 0016).

## Components

- `MapFactory.ts`: The main orchestrator for map generation. It handles the `generate`, `load`, `assemble`, and `fromAscii` methods. It delegates actual generation to specific strategies and post-processing to `MapSanitizer` and `MapValidator`.
- `MapSanitizer.ts`: Contains logic for cleaning up map artifacts, standardizing wall segments, and culling unreachable cells.
- `MapValidator.ts`: Implements rules for map correctness, including connectivity checks and entity placement constraints.
- `index.ts`: Barrel file exporting all components of the map system.

## Usage

The system follows the Configuration Object Pattern from ADR 0013.

```typescript
import { MapFactory } from "@src/engine/map/MapFactory";

const config = {
  seed: 12345,
  width: 16,
  height: 16,
  type: MapGeneratorType.Procedural,
  spawnPointCount: 3,
};

const map = MapFactory.generate(config);
```
