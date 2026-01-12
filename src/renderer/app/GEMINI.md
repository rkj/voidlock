# src/renderer/app

This directory contains the application lifecycle and bootstrapping logic for the Voidlock renderer (ADR 0019).

## Components

- `GameApp.ts`: The main orchestrator for the application. It handles initialization, starting, and stopping of the game.
- `AppContext.ts`: A simple Dependency Injection (DI) container or Service Locator that holds references to singletons and managers.
- `InputBinder.ts`: Responsible for attaching and detaching DOM event listeners, separating event handling from application logic.

## Usage

The application is initialized in `src/renderer/main.ts`:

```typescript
const app = new GameApp();
app.initialize().then(() => app.start());
```
