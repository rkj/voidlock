# src/renderer/app

This directory contains the application lifecycle and bootstrapping logic for the Voidlock renderer (ADR 0019).

## Components

- `GameApp.ts`: The main orchestrator for the application. It handles initialization, starting, and stopping of the game. It also manages the Mission Setup screen, including the Squad Builder with Quick Actions (Recruit, Revive), and handles mission replay loading from JSON files.
- `MissionSetupManager.ts`: Manages the mission configuration state, persistence, and UI synchronization for both Campaign and Custom Simulation modes.
- `AppContext.ts`: A simple Dependency Injection (DI) container or Service Locator that holds references to singletons and managers.
- `InputBinder.ts`: Responsible for attaching and detaching DOM event listeners, separating event handling from application logic. It uses a callback-based approach to notify `GameApp` of UI changes (Mission Setup toggles, selectors, etc.).

## Usage

The application is initialized in `src/renderer/main.ts`:

```typescript
const app = new GameApp();
app.initialize().then(() => app.start());
```
