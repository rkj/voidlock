# ADR 0008: Renderer & UI Separation

**Status:** Implemented

## Context

Xenopurge requires a high-performance tactical display for the game world alongside a complex, interactive User Interface (UI). Attempting to render the entire UI within the same HTML5 Canvas used for the game world leads to several challenges:
- **Complexity**: Manual hit-testing and event handling for UI elements on a Canvas is error-prone and difficult to maintain.
- **Accessibility**: Canvas-based text and buttons are invisible to screen readers and lack native browser features like tooltips and selectable text.
- **Layout**: Implementing responsive layouts (flexbox, grid) manually in Canvas is significantly more difficult than using standard CSS.
- **Maintenance**: Styling UI elements in code (Canvas API) is less intuitive than using CSS.

## Solution

We have adopted a **Hybrid Rendering Architecture** that separates the game world from the user interface.

### 1. Canvas World Renderer (`Renderer.ts`)

The "Main Simulation Area" is rendered on an `<canvas>` element. This is ideal for the high-frequency updates required by the game simulation.

- **Responsibility**: Rendering the grid, shared boundaries (walls/doors), unit/enemy positions, line-of-sight (LOS) polygons, movement paths, and fog of war.
- **Coordinate System**: Translates between engine-space grid coordinates (e.g., `x, y`) and screen-space pixels based on `cellSize` and zoom.
- **Performance**: Uses standard Canvas 2D API optimized for the 2D top-down perspective.

### 2. DOM UI Layer (`HUDManager.ts` & `ScreenManager.ts`)

All interactive UI elements, overlays, and screens (Main Menu, Squad Configuration, HUD) are implemented using standard HTML/CSS.

- **Responsibility**: 
    - **Header**: Game time, status, and threat meter.
    - **Squad Bar**: Horizontal list of soldier cards with HP bars and stat icons.
    - **Command Panel**: Hierarchical command menu and enemy intel grouping.
    - **Screens**: Full-screen overlays for menus and mission setup.
- **Benefits**: 
    - Leverages the browser's layout engine for responsive design.
    - Native support for tooltips (`title` attribute) and accessibility.
    - Easy styling and animations via CSS.
- **Interaction**: The DOM UI communicates with the engine via the `GameClient` and `MenuController`, issuing `Command` objects based on user clicks or key presses.

### 3. Unified Input Management (`InputManager.ts`)

To bridge the two systems, a dedicated `InputManager` coordinates interactions.

- **Canvas Interaction**: Uses `Renderer.getCellCoordinates()` to translate mouse clicks on the canvas into grid coordinates for target selection.
- **Keyboard Navigation**: Maps physical keys to the hierarchical command menu rendered in the DOM.
- **Coordination**: Ensures that clicking a UI button doesn't accidentally trigger a "Move" command on the map beneath it.

## Design Principles

- **Separation of Concerns**: The `Renderer` should not know about the "Menu State"; it only renders what is in the `GameState` or `OverlayOptions`.
- **Stateless UI**: The DOM UI should be a reflection of the `GameState` received from the engine, avoiding local state duplication where possible.
- **Asset Reuse**: Stat icons and soldier data structures are shared between the Canvas (for overlays) and the DOM (for cards).

## References

- [User Interface Specification](../../spec/ui.md)
- `src/renderer/Renderer.ts`: Canvas rendering implementation.
- `src/renderer/ui/HUDManager.ts`: DOM-based HUD management.
- `src/renderer/ScreenManager.ts`: Management of UI screens.
- `src/renderer/InputManager.ts`: Coordination of Canvas and DOM input.
