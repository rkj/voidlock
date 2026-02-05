# src/renderer/visuals

This directory contains the layered rendering system for Voidlock (ADR 0018).

## Components

- `GameRenderer.ts`: The main compositor that orchestrates rendering across multiple layers. It manages the canvas, global transforms, and shared state.
- `RenderLayer.ts`: Defines the `RenderLayer` interface that all visual layers must implement.
- `SharedRendererState.ts`: Holds common rendering parameters (like `cellSize` and `unitStyle`) and cached objects (like the `Graph`) that are shared across layers.
- `AssetManager.ts`: A singleton responsible for loading and caching sprites and icons.
- `MapLayer.ts`: Renders the static map geometry (floors, walls), doors (including animations), and fog of war.
- `MapEntityLayer.ts`: Renders static map entities like spawn points, extraction zones, loot crates, and objectives. Uses icons/sprites for these entities in both `Standard` and `TacticalIcons` modes to ensure visual clarity. All entities respect Fog of War and only render when their cell is discovered or visible (ADR 0032).
- `UnitLayer.ts`: Renders dynamic entities (soldiers, enemies), health bars, and movement paths. Enemies are identified by stable alphabetical indicators (A, B, C...). Enemies respect LOS/Fog of War unless `debugOverlayEnabled` is active.
- `EffectLayer.ts`: Renders transient visual effects like event-based weapon tracers.
- `OverlayLayer.ts`: Renders UI-related overlays like objectives, debug info, LOS visualizations, and tactical labels. Respects `renderOnBoard` property of `OverlayOption` to allow menu-only tactical labels.

## Architecture

The system follows a compositor pattern. The `GameRenderer` maintains a stack of layers and calls their `draw` method in sequence. This allows for better separation of concerns and facilitates future optimizations like layer-specific caching.

## Related ADRs

- [ADR 0018: Layered Renderer Architecture](../../docs/adr/0018-layered-renderer-architecture.md)
- [ADR 0026: Geometric LOS and LOF Precision](../../docs/adr/0026-geometric-los-lof-precision.md)
