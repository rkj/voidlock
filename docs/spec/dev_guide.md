# Developer Guide

## 12) Acceptance criteria (definition of “done” for this GDD)

- A user can open the page, tweak config, generate a map, and complete/fail a mission.
- A bot can play the same mission using only the JSON protocol.
- Any run can be replayed deterministically from exported JSON.
- Balancing can be changed without editing engine code (content pack swap).
- UI supports keyboard-driven gameplay and provides clear tactical feedback (soldier list, tracers).
- Map resembles a tight spaceship interior with edge-based walls.

---

## 13) Agent Debugging & Visual Feedback

- **Visual Debugging Limitations**: As an AI agent, direct visual inspection of the UI is not possible.
- **Effective Feedback**: When reporting visual issues, users must provide:
  - **Highly Detailed Text Descriptions**: Be as precise as possible regarding colors (e.g., "doors are solid yellow, not dark grey as expected for closed state"), dimensions (e.g., "doors are 2 pixels wide instead of 10"), positions (e.g., "door at (3,0)-(3,1)"), and any unexpected visual behavior. Compare against expectations.
  - **Behavioral Descriptions**: Clearly explain what actions are observed (e.g., "soldier at (1,1) is shooting enemy at (5,5) directly through the wall segment between (2,2) and (3,2)").
  - **Contextual Information**: Mention the map loaded, unit positions, door states, etc.
- **Status Display**: The UI should explicitly show when a unit's movement is blocked by a door (e.g., status "Waiting for Door").
- **Console Output**: Debug logs in the browser console remain critical for understanding runtime state and should be provided when requested.
- **Agent Browser Environment**: The agent's internal browser operates in a headless environment. If a headful browser is attempted, an X server must be present. When reporting issues, assume the agent is using a headless browser.

---

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

---

### Critical Runtime Errors

- **"Maximum call stack size exceeded"**: Observed in browser console logs during live gameplay. This is a critical error likely indicating infinite recursion. Despite passing unit tests for core mechanics, this runtime error persists and must be addressed immediately, as it will impact core game logic (pathfinding, LOS, door states, unit actions). A full stack trace from the browser console is required for debugging.

---

## 15) Deployment

### 15.1 GitHub Pages

The project uses GitHub Actions to automatically build and deploy to GitHub Pages.

- **Workflow File**: `.github/workflows/deploy.yml`
- **Trigger**: Pushes to the `main` branch.
- **Process**:
  1.  Checkout code.
  2.  Setup Node.js.
  3.  Install dependencies (`npm ci`).
  4.  Build project (`npm run build`).
  5.  Deploy `dist/` directory to GitHub Pages via the official `actions/deploy-pages`.
- **Configuration**:
  - **Vite Base Path**: The `base` property in `vite.config.ts` is conditionally set to `'/voidlock/'` during production builds to ensure assets load correctly on GitHub Pages.
