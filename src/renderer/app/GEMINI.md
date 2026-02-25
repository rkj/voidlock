# src/renderer/app

This directory contains the application lifecycle and bootstrapping logic for the Voidlock renderer (ADR 0019).

## Architecture Decomposition (ADR 0047)

`GameApp.ts` has been decomposed into specialized orchestrators to improve maintainability and adhere to SOLID principles:
- **NavigationOrchestrator**: Handles screen transitions and shell synchronization.
- **MissionRunner**: Manages mission lifecycle and callbacks.
- **InputOrchestrator**: Consolidates tactical input handling (pan/zoom/unit selection).
- **UIOrchestrator**: Manages global UI elements (drawers, HUD sync, speed UI).
- **AppServiceRegistry**: Manages initialization and access to core services.

## Components

- `GameApp.ts`: The main orchestrator for the application. It handles initialization, starting, and stopping of the game. Now acts as a minimal entry point that delegates to specialized orchestrators.
- `NavigationOrchestrator.ts`: Wraps `ScreenManager` and `CampaignShell` to handle complex screen transitions (ADR 0047). It owns the authoritative `switchScreen` method, ensuring proper input context cleanup and shell synchronization across tactical and strategic layers. Also handles high-level campaign node selection and equipment confirmation flows.
- `AppServiceRegistry.ts`: A central hub responsible for the instantiation and lifecycle management of core services (GameClient, Managers, ThemeManager). It removes initialization boilerplate from `GameApp`.
- `MissionRunner.ts`: Manages the mission lifecycle by wrapping `MissionCoordinator`. It handles launch, resume, and abort logic, and manages mission-related callbacks (onComplete, updateUI).
- `InputOrchestrator.ts`: Consolidates tactical input handling (pan/zoom/unit selection). It coordinates between the InputManager, GameClient, and MissionRunner to handle tactical interactions.
- `UIOrchestrator.ts`: Manages global UI elements, including responsive drawers, mission HUD visibility, and speed UI synchronization. Now implements authoritative pause/resume and logarithmic speed mapping (ADR 0048).
- `MissionSetupManager.ts`: Manages the mission configuration state, persistence, and UI synchronization for both Campaign and Custom Simulation modes.
- `InputBinder.ts`: Responsible for attaching and detaching DOM event listeners, separating event handling from application logic. It uses a callback-based approach to notify `GameApp` of UI changes (Mission Setup toggles, selectors, etc.).

## Usage

The application is initialized in `src/renderer/main.ts`:

```typescript
const app = new GameApp();
app.initialize().then(() => app.start());
```
