# Developer Guide

## 12) Acceptance criteria (definition of “done” for this GDD)

- A user can open the page, tweak config, generate a map, and complete/fail a mission.
- A bot can play the same mission using only the JSON protocol.
- Any run can be replayed deterministically from exported JSON.
- Balancing can be changed without editing engine code (content pack swap).
- UI supports keyboard-driven gameplay and provides clear tactical feedback (soldier list, tracers).
- Map resembles a tight spaceship interior with edge-based walls.

______________________________________________________________________

## 13) Agent Debugging & Visual Feedback

- **Visual Debugging Limitations**: As an AI agent, direct visual inspection of the UI is not possible.
- **Effective Feedback**: When reporting visual issues, users must provide:
  - **Highly Detailed Text Descriptions**: Be as precise as possible regarding colors (e.g., "doors are solid yellow, not dark grey as expected for closed state"), dimensions (e.g., "doors are 2 pixels wide instead of 10"), positions (e.g., "door at (3,0)-(3,1)"), and any unexpected visual behavior. Compare against expectations.
  - **Behavioral Descriptions**: Clearly explain what actions are observed (e.g., "soldier at (1,1) is shooting enemy at (5,5) directly through the wall segment between (2,2) and (3,2)").
  - **Contextual Information**: Mention the map loaded, unit positions, door states, etc.
- **Status Display**: The UI should explicitly show when a unit's movement is blocked by a door (e.g., status "Waiting for Door").
- **Console Output**: Debug logs in the browser console remain critical for understanding runtime state and should be provided when requested.
- **Agent Browser Environment**: The agent's internal browser operates in a headless environment. If a headful browser is attempted, an X server must be present. When reporting issues, assume the agent is using a headless browser.

______________________________________________________________________

## 14) Testing and Debugging Strategy

- **Unit Test First Approach**: For core game mechanics (GameGrid, Pathfinder, LineOfSight, door logic), comprehensive unit tests are paramount.
  - **Test Maps**: Define small, fixed JSON `MapDefinition`s directly within tests (or load from test assets) to cover specific scenarios:
    - **Extremely Small Debug Maps**: Create maps as small as 2x2 with minimal features (e.g., 2 floor cells and a wall/door) to isolate and test core mechanics and potential recursion bugs.
    - Basic open paths.
    - Paths blocked by walls.
    - Paths blocked/allowed by doors in various states (Closed, Open, Locked, Destroyed).
    - Complex wall/door configurations (e.g., corners, multi-segment doors).
  - **Test Scope**: Unit tests must verify:
    - `GameGrid.canMove`: Correctly identifies traversable segments based on walls and door states.
    - `Pathfinder.findPath`: Finds correct paths or returns null when blocked, respecting door states.
    - `LineOfSight.hasLineOfSight`: Correctly determines visibility, respecting walls and door states.
- **Iterative Debugging**:
  - Add debug `console.log` statements strategically in relevant engine code (GameGrid, Pathfinder, LineOfSight, CoreEngine) when a bug is suspected.
  - Run specific unit tests or controlled browser scenarios.
  - Analyze console output to pinpoint logical errors.
  - Remove debug logs once the issue is resolved and tests pass.
- **Test Execution**: Run tests using `npx vitest run` to ensure non-interactive execution, especially in automated environments. Avoid `npx vitest` without `run` as it defaults to interactive watch mode.
  - **Commit Frequency**: The agent must commit changes after the completion of _every_ Beads task.

______________________________________________________________________

### Critical Runtime Errors

- **"Maximum call stack size exceeded"**: Observed in browser console logs during live gameplay. This is a critical error likely indicating infinite recursion. Despite passing unit tests for core mechanics, this runtime error persists and must be addressed immediately, as it will impact core game logic (pathfinding, LOS, door states, unit actions). A full stack trace from the browser console is required for debugging.

______________________________________________________________________

## 15) Deployment

### 15.1 GitHub Pages

The project uses GitHub Actions to automatically build and deploy to GitHub Pages.

- **Workflow File**: `.github/workflows/deploy.yml`
- **Trigger**: Pushes to the `main` branch.
- **Process**:
  1. Checkout code.
  1. Setup Node.js.
  1. Install dependencies (`npm ci`).
  1. Build project (`npm run build`).
  1. Deploy `dist/` directory to GitHub Pages via the official `actions/deploy-pages`.
- **Configuration**:
  - **Vite Base Path**: The `base` property in `vite.config.ts` is conditionally set to `'/voidlock/'` during production builds to ensure assets load correctly on GitHub Pages.

______________________________________________________________________

## 16) Code Quality & Best Practices

All code must be clean, well-factored, easy to read, and follow these best practices.

### 16.1 General Standards

- **Readability**: Code should be self-documenting. Use clear, descriptive variable and function names.
- **Factorization**: Break down complex functions into smaller, reusable components.
- **Cleanliness**: Remove unused variables, imports, and commented-out code.
- **Consistency**: Follow the existing style and naming conventions of the project.

### 16.2 Type Safety & Casting

- **Zero Tolerance for `any`**: Strictly forbidden. Use `unknown` with type guards.
- **Avoid `as` Casting**: Prefer Type Guards (`isWeapon(item)`) over assertions (`item as Weapon`).
- **Control Flow Narrowing**: When TypeScript control flow analysis incorrectly narrows a mutable property (causing 'overlap' errors), prefer capturing the property into a `const` variable before the check. This preserves the original property's type for future checks and improves readability, avoiding `as` casting hacks.
  - _Example_:

    ```typescript
    // Bad
    if (this.state.type === 'A') { ... } // TS narrows this.state
    // ... later ...
    if (this.state.type === 'B') { ... } // Error: Type 'B' is not overlapping with 'A'

    // Good
    const state = this.state;
    if (state.type === 'A') { ... }
    if (state.type === 'B') { ... }
    ```

### 16.3 Performance Hygiene

- **No Deep Cloning in Loops**: Avoid `JSON.parse(JSON.stringify(...))` in hot paths.
- **Object Stability**: Minimize object creation in `render()` loops to reduce GC pressure.

### 16.4 Layout & Responsive Design

- **Avoid Fixed Pixel Sizing**: Use `flex`, `grid`, `rem`, or percentages. Fixed widths (`px`) for containers and fixed heights (`px`) for cards are forbidden unless explicitly specified in a Design Spec.
- **Content-Driven Scaling**: Cards and panels should stretch to fit their content (`height: auto`) rather than clipping with `overflow: hidden`.
- **Responsive Widths**: Use `max-width` with `width: 100%` for centralized layouts to ensure readability on wide screens while maintaining responsiveness on smaller ones (e.g., `max-width: 800px` for forms).
- **Uniform Component Rendering**: Always use shared components (e.g., `SoldierWidget`) to ensure visual consistency across different UI screens.

______________________________________________________________________

## 17) Asset Pipeline

Voidlock uses a custom script to process raw assets into web-optimized formats.

### 17.1 Workflow

1. **Source**: Raw assets (PNG) are placed in `NanoBanana Assets/`.
1. **Processing**: Run `npm run process-assets`.
   - This script uses `sharp` to trim transparency, resize to 128x128, and convert to WebP.
   - **Constraint**: `sharp` is required. The script will fail if it is not installed. There is no PNG fallback.
1. **Output**: Processed assets are saved to `public/assets/` and indexed in `public/assets/assets.json`.
1. **Usage**: The `AssetManager` loads `assets.json` at runtime to resolve logical names to file paths.

### 17.2 Adding New Assets

1. Add the raw PNG file to `NanoBanana Assets/`.
1. Update the `MAPPING` object in `scripts/process_assets.ts`.
   - Key: Source filename (case-sensitive).
   - Value: Target filename (e.g., `my_asset.webp`).
1. Run `npm run process-assets`.
1. Register the new asset in `AssetManager` (for dynamic sprites) or `Icons` (for static UI icons).
