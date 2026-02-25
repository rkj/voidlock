# ADR 0050: UI Synchronization Strategy - Reactive UIBinder vs. React

## Status

Proposed

## Context

The project suffers from frequent UI/Engine desynchronization (e.g., speed sliders not moving when paused via shortcuts, button labels flickering, and threat bars lagging). While the game world rendering (Canvas) is high-performance, the UI management (Vanilla DOM) has reached a complexity ceiling where manual "fire-and-forget" updates are failing to maintain state integrity.

## Evaluation: The Framework Crossroad

### Option A: Structural Migration to React

React is the industry standard for declarative UI. A migration would involve wrapping the game in a React provider and building screens as functional components.

- **Pros**:
  - **Automatic Diffing**: Prevents visual flickering and "zombie" UI states by ensuring the DOM always reflects the latest state.
  - **Ecosystem**: Access to mature gesture and animation libraries (e.g., `framer-motion`, `use-gesture`).
- **Cons**:
  - **The "60 FPS Tax"**: Voidlock receives state updates from a Web Worker every 16ms. React's Virtual DOM (VDOM) reconciliation cycle is not designed for this frequency and can cause main-thread stutter on mobile devices.
  - **The "Mutation Bridge" Necessity**: To achieve high performance in games, React must often be bypassed (using `useRef` and direct mutation) for fast-changing elements like threat meters or clocks. This negates the primary benefit of React for our most critical UI components.
  - **Architectural Bifurcation**: The project is currently 100% Class-based TypeScript. React would introduce a Hook-based paradigm, splitting the mental model and doubling the architectural complexity.
  - **Bundle Bloat**: Adds ~40KB-100KB of dependency for a UI that currently consists of only ~6 tactical screens.

### Option B: Surgical Implementation of `UIBinder`

A lightweight, custom reactive system that applies the "Mutation Loop" philosophy directly to our existing Class-based architecture.

- **Pros**:
  - **Zero-Overhead Reactivity**: Implements "Dirty Checking" to ensure the DOM is only touched when values actually change, providing the performance of manual mutation with the safety of a framework.
  - **Architectural Uniformity**: Keeps the project strictly Class-based and TypeScript-native. No "split-brain" between Hooks and Classes.
  - **Perfect Synchronization**: Updates the DOM in the same execution block as the Canvas render, eliminating "UI Tearing" where the HUD lags behind the map visuals.
  - **Declarative HTML**: Uses `data-bind` attributes in the existing `index.html`, allowing us to solve the "Zombie Slider" bug with minimal code changes.
- **Cons**:
  - **Custom Maintenance**: Requires maintaining a small utility class (~2KB) instead of relying on a community framework.

## Decision: The "Surgical" Hybrid Architecture

**We will implement a custom Reactive UI Binder (`UIBinder`).**

We choose Option B because it fulfills the **Hybrid Architecture** requirement—using the DOM for UI and Canvas for the world—while maintaining the high-performance "Mutation Loop" necessary for a 60fps mobile game. We reject React at this stage because we would ultimately have to bypass its core declarative mechanism (via Refs and direct mutations) to keep the HUD snappy, making the framework an unnecessary abstraction layer.

### Technical Implementation: The `UIBinder` Pattern

1. **Declarative Mapping**: UI elements in `index.html` will be marked with `data-bind-<type>` attributes (e.g., `data-bind-value="settings.timeScale"`).
1. **Transformation Pipeline**: The binder will support "Transformers" to handle logarithmic mappings (e.g., mapping raw 0.1x timescale to 0-100 slider values) and conditional visibility (e.g., hiding the speed slider during Deployment).
1. **The Update Loop**: `HUDManager` will act as the orchestrator, calling `UIBinder.sync(state)` every tick.
1. **Closed-Loop Inputs**: For interactive elements like sliders, the binder will manage the two-way sync:
   - **Engine -> UI**: Engine changes update the slider position.
   - **UI -> Engine**: User interactions dispatch commands to the engine, which then flow back to the UI to confirm the state.

## Consequences

- **Reliability**: The "Zombie Slider" and "Blinking Button" bugs are resolved by a single, authoritative sync path.
- **Performance**: Frame rates on mobile will remain stable as we avoid VDOM reconciliation.
- **Developer Experience**: Adding new UI elements becomes a declarative task (adding a data attribute) rather than a procedural one (writing `getElementById` and `.textContent` logic).
