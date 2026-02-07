# 38. Mobile Interaction Strategy

Date: 2026-02-06

## Status

Proposed

## Context

Voidlock is currently designed for Desktop with keyboard-first navigation and mouse-driven tactical selection. To support mobile devices (**[Spec 10]**), we need a clear strategy for handling touch-specific constraints:

1.  **Hover State**: How to expose "Hover" information (Tooltips, Stat details) without a mouse.
2.  **Movement Control**: Deciding between Virtual Joysticks (Action-oriented) vs. Tap-to-Move (Tactical-oriented).
3.  **Responsive Layout**: Choosing the CSS strategy for "Compact Mode" layout shifts.

## Decision

We will implement a touch-optimized tactical interface that prioritizes precision and readability over direct unit control.

### 1. "Tap-to-Inspect" for Tooltips

Since touch devices lack a `hover` state, we will implement a "Tap-to-Inspect" pattern for all informational tooltips and stat cards.

- **Trigger**: A single tap on an informational element (e.g., a soldier card's stat icon, an enemy intel block).
- **Behavior**: Tapping toggles a persistent "Inspect Popover" or an expanded state of the component.
- **Dismissal**: Tapping outside the info element or tapping it a second time dismisses the information.
- **Engine Support**: The `InputDispatcher` will be updated to distinguish between "Selection Taps" (Game World) and "Inspect Taps" (UI).

### 2. Tactical Control: Tap-to-Move (Point-and-Click)

We will **REJECT** Virtual Joysticks in favor of a **Tap-to-Move** and **Hierarchical Menu** interaction model.

- **Rationale**: Voidlock is a Real-Time with Pause (RTwP) squad management game. Virtual joysticks are poorly suited for commanding multiple units and precise tile-based targeting.
- **Camera Interactions**:
  - **One-Finger Drag**: Panning the map.
  - **Two-Finger Pinch**: Zooming (implemented via the `Renderer` scale transform).
- **Unit Commanding**:
  - **Select**: Tap unit sprite on map or unit card in HUD.
  - **Action**: Tap command in the hierarchical menu (buttons scaled to 44px height).
  - **Target**: Tap a room, unit, or intersection on the map to confirm the command target.

### 3. CSS Strategy: Hybrid Media & Container Queries

We will adopt a hybrid CSS strategy to manage the transition from "Desktop/Tablet" to "Compact/Mobile" modes.

- **Viewport Media Queries**: Used for high-level **Shell Layout**.
  - On screens `< 768px`, the `Right Panel` (Objectives/Intel) and `Left Panel` (Squad) will collapse into toggleable "Drawers" (sliding overlays).
  - The `Top Bar` will prioritize the Pause button and Threat Meter, moving the speed slider into a secondary menu if necessary.
- **Container Queries**: Used for **Reusable Components** (e.g., `SoldierCard`, `StatDisplay`).
  - Components will adapt their internal layout based on the width of their immediate parent.
  - *Example*: A `SoldierCard` will render horizontally (Label: Value) in a wide list, but switch to vertically stacked (Icon / Value) when squeezed into a mobile drawer.
  - *Rule*: `container-type: inline-size` will be applied to all major layout panels.

### 4. Touch Target Minimums

All interactive elements (buttons, menu items, roster cards) MUST adhere to a minimum hit area of **44x44px** when in mobile mode.

- The CSS will use a global `.mobile-touch` class on `<body>` (detected via Media Query or User Agent) to increase padding and margins for interactive targets.

## Consequences

### Positive

- **Strategic Depth**: Preserves the tactical nature of the game on small screens.
- **Component Reusability**: Container queries make UI components robust to different screen sizes and future layout changes.
- **Consistency**: The mental model remains "Issue commands to a squad" rather than "Control a character."

### Negative

- **Input Complexity**: Requires careful handling of touch events to prevent accidental pans while trying to tap units.
- **UI Density**: "Tap-to-Inspect" adds more taps to the user journey compared to desktop hovering.
