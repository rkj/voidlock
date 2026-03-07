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
- `NavigationOrchestrator.ts`: Wraps `ScreenManager` and `CampaignShell` to handle complex screen transitions (ADR 0047). It owns the authoritative `switchScreen` method, ensuring proper input context cleanup and shell synchronization across tactical and strategic layers. It also implements snappy, tactical transition animations (Spec 8.1) for all screen changes. Now implements the **Guided Prologue Flow** (ADR 0049) by skipping the Sector Map and locking down UI elements when the Prologue mission is active. Also implements the **Mission 2 Ready Room** tutorial flow, and the **Mission 3 Sector Map** tutorial flow, unlocking the strategic layer and squad selection sequentially. **Validation (voidlock-n4sd6):** Implements a safety check in `onLaunchMission` to prevent starting a mission with an empty squad, providing user feedback via an alert.
- `AppServiceRegistry.ts`: A central hub responsible for the instantiation and lifecycle management of core services (GameClient, Managers, ThemeManager). It removes initialization boilerplate from `GameApp`.
- `MissionRunner.ts`: Manages the mission lifecycle by wrapping `MissionCoordinator`. It handles launch, resume, and abort logic, and manages mission-related callbacks (onComplete, updateUI).
- `InputOrchestrator.ts`: Consolidates tactical input handling (pan/zoom/unit selection). It coordinates between the InputManager, GameClient, and MissionRunner to handle tactical interactions.
- `UIOrchestrator.ts`: Manages global UI elements, including responsive drawers, mission HUD visibility, and speed UI synchronization. Now implements authoritative pause/resume and logarithmic speed mapping (ADR 0048). Handles global delegated event listeners for the 'game-speed' slider to ensure consistent behavior across dynamic HUD injections and maintains targetTimeScale synchronization.
- `MissionSetupManager.ts`: Manages the mission configuration state, persistence, and UI synchronization for both Campaign and Custom Simulation modes. Now enforces a single-soldier squad for the Prologue mission.
- `InputBinder.ts`: Responsible for attaching and detaching DOM event listeners, separating event handling from application logic. It uses a callback-based approach to notify `GameApp` of UI changes (Mission Setup toggles, selectors, etc.). Now correctly handles mission-type, theme, and unit-style selection events.

## Usage

The application is initialized in `src/renderer/main.ts`:

```typescript
const app = new GameApp();
app.initialize().then(() => app.start());
```
