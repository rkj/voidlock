# ADR 0018: Layered Renderer Architecture

## Context

The `src/renderer/Renderer.ts` is a monolithic class (~1000 lines) responsible for all rendering operations. It imperatively draws the map, units, items, fog of war, and UI overlays in a single `render` loop.

Issues:

1.  **Performance:** It redraws static elements (floors/walls) every frame, even if they haven't changed.
2.  **Maintainability:** Adding a new visual effect (e.g., a status icon) requires modifying the core render loop.
3.  **Complexity:** Asset loading, coordinate transformation, and drawing logic are intertwined.

## Decision

We will adopt a **Layered Architecture** for the renderer in `src/renderer/visuals/`.

### Components

1.  **`GameRenderer` (Compositor):**
    - Main entry point.
    - Manages the HTML5 Canvas context.
    - Orchestrates the `render()` calls to sub-layers.
    - Handles global transforms (camera panning/zooming).

2.  **`RenderLayer` (Interface):**
    - Method: `draw(ctx: CanvasRenderingContext2D, state: GameState, deltaTime: number)`.

3.  **Concrete Layers:**
    - **`MapLayer`:** Draws static geometry (Floor, Walls, Doors). Optimized to only redraw visible areas or use cached bitmaps.
    - **`UnitLayer`:** Draws dynamic entities (Soldiers, Enemies, Corpses). Handles sprite selection and health bars.
    - **`EffectLayer`:** Draws transient effects (Tracers, Explosions, Floating Text).
    - **`OverlayLayer`:** Draws UI helpers (Selection rings, Grid lines, Fog of War, Debug info).

## Consequences

- **Positive:**
  - **Optimization:** Static layers can be cached or redrawn less frequently.
  - **Extensibility:** New visual features can be added as new Layers without touching the core loop.
- **Negative:** Might introduce slight overhead from multiple iterations over the game state (one per layer).
