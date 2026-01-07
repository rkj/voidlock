# tests/engine/mapgen

Tests for map assembly, validation (connectivity and Void cell rules), and sanitization (removing orphaned cells or walls).

- `MapValidation.test.ts`: Specifically covers rules about Floor/Void boundaries and entity placement on valid cells.
- `MapAssembly.test.ts`: Tests the `MapGenerator.assemble` logic for building maps from tiles.
- `SpaceHulkImporter.test.ts`: Tests importing maps from the Space Hulk tile set.