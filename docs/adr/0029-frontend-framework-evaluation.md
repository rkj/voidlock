# ADR 0029: Frontend Framework Evaluation

**Date:** 2026-01-21
**Status:** Accepted

## Context

The Voidlock project currently utilizes a "Hybrid Architecture" (ADR 0008) where the game world is rendered via HTML5 Canvas and the UI is built using Vanilla TypeScript and DOM manipulation. As the application grows, screens like `SquadBuilder` and `EquipmentScreen` are becoming increasingly complex, managing their own local state and DOM lifecycles.

We need to evaluate whether continuing with custom Vanilla DOM manipulation is sustainable or if we should migrate the UI layer to a frontend framework (e.g., React, SolidJS, Vue).

## Analysis

### 1. Current Architecture (Vanilla TypeScript)

- **Pattern:** Immediate-mode style updates for HUD (re-rendering innerHTML) and Component-style classes for Screens (managing their own root elements).
- **State:** Local class properties act as state. `render()` methods are called manually after state changes.
- **Performance:** extremely high. Direct DOM updates have zero library overhead.
- **Dependencies:** None.
- **Development Experience:** "Close to the metal." Full control, but requires writing boilerplate for element creation, event delegation, and diffing (or nuking `innerHTML`).

### 2. Framework Alternative (e.g., React/Preact)

- **Pattern:** Declarative components.
- **State:** `useState`, `useReducer`, Context API.
- **Performance:** Virtual DOM (VDOM) overhead. In a game loop running at 60 FPS, syncing the React tree with the Engine's `GameState` can be costly if not heavily optimized (e.g., `memo`, `useRef` bridges).
- **Development Experience:** Faster iteration for complex forms and lists. extensive ecosystem.

## Decision

**We will continue to use Vanilla TypeScript for the UI Layer.**

We will **NOT** adopt a frontend framework at this time.

## Rationale

1.  **Performance & Overhead:**
    - The game loop dictates the render cycle. We need absolute control over when the DOM updates relative to the Canvas frame.
    - Frameworks often assume they "own" the page lifecycle. Integrating them with a custom game loop often leads to fighting the framework (e.g., "tearing" issues or unnecessary re-renders).
    - Adding ~40KB+ (React+DOM) to the bundle is unnecessary for what is essentially 4-5 static screens and one HUD overlay.

2.  **Architectural Simplicity:**
    - The current codebase is uniform (all TypeScript classes). Introducing a framework bifurcates the mental model: "How does the GameClient talk to a React Component?" vs "How does it talk to the Canvas?".
    - We avoid the complexity of a dual-state world (React State vs Engine State).

3.  **Current Complexity is Manageable:**
    - The most complex screens (`EquipmentScreen`, `SquadBuilder`) essentially follow a pattern of "State Change -> Clear Container -> Re-render". While crude, this is effective and bug-free for our current scale.
    - We have successfully implemented a `ModalService` and Reusable Components (`StatDisplay`) without a framework.

4.  **Error Prone Concerns:**
    - Frameworks hide complexity. In a deterministic simulation environment, "hidden" behavior is a liability.
    - Custom DOM code explicitly defines _exactly_ what happens on every user interaction, reducing the surface area for "magic" bugs.

## Future Considerations

If the project requirements shift to include **complex, nested, non-game UI** (e.g., a massive encyclopedic Codex, a social lobby system, or a visual node editor for scripting), we will re-evaluate **SolidJS** or **Svelte** as candidates due to their lack of a VDOM and lower runtime overhead compared to React.

## Consequences

- **Positive:** Zero runtime dependency bloat. Unified code style. Maximum performance potential.
- **Negative:** Boilerplate for creating DOM elements. Manual state synchronization in complex forms.
- **Mitigation:** We will continue to build small, reusable helper classes (like `StatDisplay` and `ModalService`) to abstract common DOM patterns.
