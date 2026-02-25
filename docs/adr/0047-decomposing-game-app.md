# ADR 0047: Decomposing GameApp for Maintainability

**Status:** Accepted
**Owner:** Gemini CLI

## Context

The `GameApp.ts` file has exceeded 1300 lines of code, violating the project's mandated limit of 500 lines for a single class. It currently serves as a monolithic orchestrator, handling:

1. Core service initialization and lifecycle.
1. Screen management and navigation flow.
1. Mission lifecycle (launch, resume, abort, reconcile).
1. Tactical input processing (panning, zooming, unit selection).
1. Global UI synchronization (HUD, speed controls, responsive drawers).

This monolithic structure makes it difficult to maintain, test in isolation, and extend without introducing regressions.

## Decision

We will decompose `GameApp` into several specialized orchestrators and services. `GameApp` will remain the top-level entry point but will strictly delegate domain-specific logic to these components.

### 1. AppServiceRegistry

A central hub responsible for the instantiation and lifecycle management of core services (GameClient, Managers, ThemeManager). This removes initialization boilerplate from GameApp.

### 2. NavigationOrchestrator

Wraps `ScreenManager` and `CampaignShell` to handle complex screen transitions. It will own the `switchScreen` logic and ensure proper input context cleanup when switching between tactical and strategic layers.

### 3. MissionRunner

Handles the mission lifecycle by wrapping `MissionCoordinator`. It will manage mission callbacks (onComplete, updateUI) and handle the transition from the "Ready Room" to the "Tactical Map".

### 4. InputOrchestrator

Consolidates tactical input processing. It will handle map manipulation (pan/zoom), unit cycling, and coordinate with `InputManager` for canvas-level interactions.

### 5. UIOrchestrator

Manages global HUD synchronization and responsive UI elements (drawers). It will handle the bridging between game state updates and DOM updates for global components.

## Consequences

- **Maintainability:** Smaller files (\<500 lines) are easier to navigate and reason about.
- **Testability:** Orchestrators can be unit tested with mocked services.
- **SOLID Compliance:** Adherence to Single Responsibility and Dependency Inversion principles.
- **Complexity:** Increased number of files and initial overhead in wiring dependencies.
