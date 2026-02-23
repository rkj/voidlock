# src/renderer/app

This directory contains the application lifecycle and bootstrapping logic for the Voidlock renderer (ADR 0019).

## Architecture Decomposition (ADR 0047)

`GameApp.ts` is currently being decomposed into specialized orchestrators to improve maintainability and adhere to SOLID principles:
- **NavigationOrchestrator**: Handles screen transitions and shell synchronization.
- **MissionRunner**: Manages mission lifecycle and callbacks.
- **InputOrchestrator**: Consolidates tactical input handling (pan/zoom/unit selection).
- **AppServiceRegistry**: Manages initialization and access to core services.

## Components

- `GameApp.ts`: The main orchestrator for the application. It handles initialization, starting, and stopping of the game. It also manages the Mission Setup screen, including the Squad Builder with Quick Actions (Recruit, Revive), and handles mission replay loading from JSON files. Orchestrates map panning and zooming via callbacks (ADR 0038). Delegates navigation and screen management to `NavigationOrchestrator`.
- `NavigationOrchestrator.ts`: Wraps `ScreenManager` and `CampaignShell` to handle complex screen transitions (ADR 0047). It owns the authoritative `switchScreen` method, ensuring proper input context cleanup and shell synchronization across tactical and strategic layers.
- `AppServiceRegistry.ts`: A central hub responsible for the instantiation and lifecycle management of core services (GameClient, Managers, ThemeManager). It removes initialization boilerplate from `GameApp`.
- `MissionRunner.ts`: Manages the mission lifecycle by wrapping `MissionCoordinator`. It handles launch, resume, and abort logic, and manages mission-related callbacks (onComplete, updateUI).
- `MissionSetupManager.ts`: Manages the mission configuration state, persistence, and UI synchronization for both Campaign and Custom Simulation modes.
- `InputBinder.ts`: Responsible for attaching and detaching DOM event listeners, separating event handling from application logic. It uses a callback-based approach to notify `GameApp` of UI changes (Mission Setup toggles, selectors, etc.).

## Usage

The application is initialized in `src/renderer/main.ts`:

```typescript
const app = new GameApp();
app.initialize().then(() => app.start());
```
