# src/renderer

Main thread rendering logic and user interface for Voidlock.

## Key Files

- `main.ts`: Entry point. Instantiates and starts GameApp.
- `GameShell.ts`: Main application layout and top-level DOM elements.
- `ConfigManager.ts`: Persistent game configuration in LocalStorage.
- `InputDispatcher.ts`: Centralized keyboard/mouse/touch event dispatcher with priority-based handling (ADR 0037).
- `InputManager.ts`: Tactical input context — shortcuts, mouse/touch interactions, drag-and-drop deployment (ADR 0038).
- `MenuController.ts`: Tactical command menu orchestration.
- `Renderer.ts`: Layered rendering compositor (ADR 0018).
- `ScreenManager.ts`: Screen transitions, history, URL hash sync.
- `jsx.ts` / `jsx-types.d.ts`: Custom JSX factory for Vanilla TSX (ADR 0051).

## Subdirectories

- `app/`: Application lifecycle — GameApp (central orchestrator), AppContext, InputBinder.
- `campaign/`: Campaign UI layer and state persistence.
- `components/`: Reusable UI components (SquadBuilder, etc.).
- `controllers/`: Decoupled logic managers (StateMachine, Selection, CommandBuilder, RoomDiscovery, TargetOverlay).
- `screens/`: Screen implementations (Campaign, Debrief, Equipment, Statistics, MissionSetup).
- `ui/`: UI component library (HUD panels, MenuRenderer, ModalService, SoldierInspector).
- `visuals/`: Canvas rendering layers (MapLayer, UnitLayer, EffectLayer, OverlayLayer).
- `utils/`: Rendering utilities.

## Architecture

- Receives immutable GameState snapshots from the engine worker.
- No simulation logic — purely presentation.
- Vanilla TypeScript + custom JSX (no React/Vue/Angular).
- See `docs/ARCHITECTURE.md` for full system overview, relevant ADRs for specific decisions.
