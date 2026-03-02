# ADR 0051: Vanilla TSX for Component-Based UI

## Status

Accepted

## Context

The project's UI views are currently hardcoded directly in `index.html`. As the application has grown, this approach has demonstrated several significant drawbacks:
- It lacks modularity and reusability.
- It makes state-driven UI updates difficult, as elements must be manually queried and mutated.
- It results in a monolithic `index.html` file that is hard to maintain and navigate.

Previously, in **ADR 0029**, we rejected the use of full frontend frameworks (like React or SolidJS) to avoid runtime bloat and the performance overhead associated with Virtual DOM reconciliation (the "60 FPS Tax"). In **ADR 0050**, we introduced `UIBinder` to handle reactive data binding against the DOM, but constructing complex elements purely via `document.createElement` inside TypeScript remains tedious and boilerplate-heavy.

The goal is to move toward a component-based architecture using **TSX (TypeScript XML)** to define views declaratively in code, while strictly maintaining our zero-dependency, lightweight footprint without introducing a full framework runtime.

## Decision

**We will adopt a "Vanilla TSX" architecture.** 

We will implement a custom, lightweight JSX factory function (commonly named `h` or `createElement`) that transforms TSX syntax directly into native `HTMLElement` nodes without a Virtual DOM or full framework runtime.

### Technical Implementation

1. **Custom JSX Factory**: Implement `createElement` and `Fragment` functions that instantiate native DOM elements and attach event listeners when given TSX props (e.g., `onClick` mapped to `addEventListener`).
2. **TypeScript Configuration**: Update `tsconfig.json` to enable TSX parsing targeting our custom factory:
   - `jsx: "react"`
   - `jsxFactory: "createElement"`
   - `jsxFragmentFactory: "Fragment"`
3. **Global Types**: Define `JSX.IntrinsicElements` globally so TypeScript correctly recognizes standard HTML tags and attributes within the project.
4. **Componentization Migration**: Gradually extract hardcoded HTML structures from `index.html` into modular `.tsx` files (e.g., `HUD`, `SquadBuilder`, `EquipmentScreen`).
5. **Integration with Current Architecture**: Since this approach lacks a Virtual DOM, manual re-rendering or integration with `UIBinder` will be required when state changes necessitate DOM updates.

## Consequences

- **Positive**: 
  - **Improved Modularity**: UI code is encapsulated into reusable components rather than a monolithic HTML file.
  - **Developer Experience**: Familiar, declarative TSX syntax replaces boilerplate `document.createElement` and `appendChild` logic.
  - **Zero Dependency**: Maintains the core constraint of having no heavy framework runtime.
- **Negative**:
  - **No Virtual DOM**: Requires developers to manually manage component lifecycles or state synchronization (though this aligns with our current architecture).
  - **Initial Overhead**: Requires building and maintaining the custom JSX factory and type definitions.
- **Neutral**: 
  - Aligns with and extends ADR 0029 by providing a better authoring experience while avoiding framework bloat.
