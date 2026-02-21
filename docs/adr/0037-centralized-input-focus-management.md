# 37. Centralized Input & Focus Management System

Date: 2026-02-06

## Status

Proposed

## Context

Input handling in Voidlock is currently fragmented across multiple components:

- `InputManager` handles tactical gameplay keys and some global shortcuts.
- `ModalService` implements its own global `keydown` listener to handle `Escape`/`Enter`.
- UI Screens (e.g., `EquipmentScreen`, `CampaignScreen`) lack standardized keyboard navigation and focus management.
- There is no mechanism to prevent "input bleeding" (e.g., pressing `Space` while a modal is open might still toggle the game pause).
- **[Spec 9]** requires a "Shortcut Help Overlay" that displays context-relevant shortcuts, but there is no central registry to query for this information.

## Decision

We will implement a **Layered Input Management System** to centralize event dispatching, focus tracking, and shortcut discovery.

### 1. The `InputDispatcher`

A singleton `InputDispatcher` will serve as the sole listener for global `keydown` and `keyup` events. It maintains a stack of `InputContext` objects.

```typescript
interface ShortcutInfo {
  key: string;
  code?: string; // Optional specific KeyboardEvent.code
  label: string;
  description: string;
  category: "General" | "Tactical" | "Navigation" | "Menu";
}

interface InputContext {
  id: string;
  priority: number; // Higher numbers handle events first
  trapsFocus: boolean; // If true, prevents focus from leaving the associated container
  handleKeyDown(e: KeyboardEvent): boolean; // returns true if consumed
  getShortcuts(): ShortcutInfo[];
}
```

### 2. Dispatch Logic

When a keyboard event occurs, the `InputDispatcher`:

1. Iterates through the stack of active `InputContext` objects from top (highest priority) to bottom.
1. Calls `handleKeyDown(e)` on each context.
1. If a context returns `true`, the event is considered consumed, and propagation stops (`e.stopPropagation()`, `e.preventDefault()` if appropriate).
1. If no context handles the event, it bubbles to the default browser behavior (unless it's a globally reserved key).

### 3. Layers & Priorities

We define standard priority tiers:

| Tier | Priority | Typical Contexts |
| :---------- | :------- | :--------------------------------------------- |
| **System** | 1000 | `ModalContext`, `AlertContext` |
| **Overlay** | 500 | `HelpOverlayContext`, `DebugConsoleContext` |
| **UI** | 100 | `ScreenContext` (Main Menu, Setup, Equipment) |
| **Game** | 50 | `TacticalContext` (Game Engine & Command Menu) |
| **Global** | 0 | `GlobalShortcuts` (Pause, Debug Toggle) |

### 4. Focus Management

The `InputDispatcher` will provide a standard `FocusTrap` utility. When a context with `trapsFocus: true` is pushed:

- It records the current `document.activeElement`.
- It listens for `Tab` keys to cycle focus strictly within its associated DOM container.
- Upon being popped, it restores focus to the previously recorded element.

### 5. Shortcut Help Overlay Architecture

The "Shortcut Help Overlay" (`?` key) will be implemented as an `OverlayContext`.

- **Discovery**: When activated, it calls `InputDispatcher.getActiveShortcuts()`, which aggregates `getShortcuts()` results from all contexts currently in the stack.
- **Filtering**: It filters out duplicates and groups shortcuts by `category`.
- **Dynamic Display**: Because it queries the stack at runtime, it automatically reflects context-specific keys (e.g., showing "1-9: Select Room" only when in the tactical `TargetSelect` state).

## Consequences

### Positive

- **Deterministic Routing**: Clear hierarchy for which component handles which key.
- **No Input Bleeding**: Modals effectively "mute" the game engine's input.
- **Unified Help**: The `?` overlay is always accurate and requires zero manual configuration per-screen.
- **Accessibility**: Standardized focus trapping is a major step toward WCAG compliance.

### Negative

- **Refactor Effort**: Requires migrating `InputManager.ts` and `ModalService.ts` to the new context pattern.
- **Learning Curve**: New screens must implement the `InputContext` interface rather than just adding listeners.
