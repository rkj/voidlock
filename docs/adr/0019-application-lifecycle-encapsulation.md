# ADR 0019: Application Lifecycle Encapsulation

## Context
The `src/renderer/main.ts` file currently executes logic in the global scope. It instantiates the `GameClient`, `Renderer`, and `InputManager` immediately upon import.

Issues:
1.  **Untestable:** You cannot import `main.ts` in a test environment without triggering the entire game startup (which fails due to missing DOM, etc.).
2.  **Global State:** Singletons and global variables make it impossible to "reset" the game cleanly between integration tests.
3.  **Initialization Order:** Dependencies are implicit based on import order.

## Decision
We will encapsulate the application bootstrapping logic into a dedicated `GameApp` class in `src/renderer/app/`.

### Components
1.  **`GameApp`:**
    -   Methods: `initialize()`, `start()`, `stop()`.
    -   Holds references to `GameClient`, `Renderer`, `ScreenManager`.

2.  **`AppContext`:**
    -   A simple Dependency Injection (DI) container or Service Locator.
    -   Holds the singletons (`ConfigManager`, `ThemeManager`) to allow mocking in tests.

3.  **`InputBinder`:**
    -   Separates the logic of *what* to do (InputManager) from *how* to listen (DOM Event Listeners).
    -   Allows attaching/detaching listeners cleanly.

### Entry Point
The `main.ts` file will become a trivial entry point:
```typescript
const app = new GameApp();
app.initialize().then(() => app.start());
```

## Consequences
-   **Positive:**
    -   **Integration Testing:** We can spin up a `new GameApp()` in a JSDOM environment, run a test scenario, and then `app.stop()` to clean up.
    -   **Robustness:** Explicit initialization lifecycle catches startup errors gracefully.
-   **Negative:** None. This is standard software engineering practice.
