# ADR 0025: ModalService Architecture

## Context

The game currently relies on native browser `alert()` and `confirm()` dialogs for critical user interactions, such as confirming data resets, notifying of shop rewards, and reporting errors. These native dialogs present several issues:

1. **Visual Inconsistency:** They use the browser's default UI, which clashes with the game's tactical, cyberpunk aesthetic.
1. **Execution Blocking:** `alert()` and `confirm()` are synchronous and block the main thread, which can interfere with the engine-renderer communication and game loop.
1. **Limited Customization:** They do not allow for custom styling, layout, or rich content (e.g., icons, formatted text).
1. **Requirement:** Section 8.10 of `spec/ui.md` explicitly mandates the replacement of native dialogs with a themed custom implementation.

## Decision

We will implement a `ModalService` to manage all in-game notifications and confirmation dialogs.

### Architecture

1. **Location:** The service will be implemented as `src/renderer/ui/ModalService.ts`.
1. **Lifecycle:** It will be instantiated and managed by `GameApp` and registered in `AppContext` for global access.
1. **UI Implementation:**
   - A dedicated container `<div id="modal-container"></div>` will be added to the end of `<body>` in `index.html`.
   - Modals will be rendered using HTML/CSS within this container.
   - A semi-transparent backdrop (`.modal-backdrop`) will be used to dim the background and intercept clicks.
   - The styling will strictly follow the project's CSS variables (e.g., `--color-primary`, `--color-background`) and tactical aesthetic.
1. **Queue Management:**
   - The service will maintain a queue of modal requests.
   - If a modal is requested while another is already visible, the new request will be queued and shown after the current one is dismissed.
1. **Programmatic API:**
   - `alert(message: string, title?: string): Promise<void>`
   - `confirm(message: string, title?: string): Promise<boolean>`
   - `show(options: ModalOptions): Promise<any>`
1. **Refactoring:**
   - `EventModal` and `OutcomeModal` (currently standalone in `src/renderer/ui/EventModal.ts`) will be refactored to use the `ModalService` for consistent presentation and queueing.
   - All existing `window.alert()` and `window.confirm()` calls will be replaced with `ModalService` calls.

## Consequences

- **Positive:**
  - **Thematic Integrity:** All dialogs will match the game's visual style.
  - **Non-Blocking:** Asynchronous Promise-based API ensures the main thread remains responsive.
  - **Consistent UX:** Centralized management prevents overlapping dialogs and ensures a stable interaction flow.
  - **Extensibility:** Easier to add complex features like narrative choices or rich-text mission briefings.
- **Negative:**
  - **Implementation Overhead:** Requires writing and maintaining custom DOM/CSS logic instead of using native features.
  - **Accessibility:** Must manually handle focus trapping, keyboard navigation (`ESC`, `Enter`), and ARIA attributes to match native dialog accessibility.
