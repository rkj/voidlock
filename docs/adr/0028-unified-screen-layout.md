# 28. Unified Screen Layout & Global Shell

Date: 2026-01-19

## Status

Accepted

## Context

The current UI architecture of Voidlock relies on a flat collection of `<div class="screen">` elements in `index.html`. Each screen is responsible for its own layout, header, footer, and scrolling behavior.

**Problems:**

1.  **Inconsistent Layouts:** Some screens have headers, some don't. Some have footers, some have buttons floating in the content.
2.  **Clipping & Scrolling Bugs:** On smaller viewports (e.g., 800x600), fixed-height headers and unconstrained content areas cause buttons (like "Confirm" or "Back") to be pushed off-screen and become inaccessible.
3.  **DOM Pollution:** All screens exist in the DOM simultaneously, hidden via `display: none`. This leads to "zombie" nodes (e.g., the unused `#screen-campaign` placeholder) and potential ID conflicts or memory leaks.
4.  **Ad-Hoc Fixes:** Fixing layout issues requires patching individual screen CSS, leading to fragmentation (e.g., the recent failed attempt to fix the Mission Setup screen).

## Decision

We will transition to a **Global Shell Architecture**.

### 1. The Global Shell (`GameShell`)

The application will have a single, persistent outer layout component (`GameShell`) that manages the viewport. It will consist of three distinct regions:

```html
<div id="game-shell">
  <header id="global-header">
    <!-- Dynamic Title & Context -->
    <h1 id="header-title"></h1>
    <div id="header-controls"><!-- Main Menu / Pause --></div>
  </header>

  <main id="main-content">
    <!-- Active Screen Content Injected Here -->
  </main>

  <footer id="global-footer">
    <!-- Primary Actions (Back, Confirm, etc.) -->
  </footer>
</div>
```

**Layout Constraints:**

- `#game-shell`: `height: 100vh`, `display: flex`, `flex-direction: column`, `overflow: hidden`.
- `#global-header`: Fixed height (e.g., 60px), `flex-shrink: 0`.
- `#global-footer`: Fixed height (e.g., 60px), `flex-shrink: 0`.
- `#main-content`: `flex-grow: 1`, `overflow-y: auto`, `min-height: 0`.

This guarantees that the Header and Footer are _always_ visible, and only the Content area scrolls.

### 2. Screen Lifecycle & Mounting

Screens will no longer be static HTML in `index.html`. They will be classes that implement a standard `Screen` interface. The `ScreenManager` will actively **mount** and **unmount** them.

**Interface:**

```typescript
interface Screen {
  // Returns the configuration for the global shell
  getLayoutConfig(): ScreenLayoutConfig;

  // Called when the screen is mounted.
  // Returns the DOM element (or string) to inject into #main-content.
  mount(): HTMLElement | string | Promise<HTMLElement | string>;

  // Called when the screen is unmounted. Cleanup listeners here.
  unmount(): void;
}

interface ScreenLayoutConfig {
  title: string;
  showBackButton?: boolean;
  onBack?: () => void;
  primaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  // ... other shell options
}
```

### 3. ScreenManager Responsibility

The `ScreenManager` will:

1.  Clear `#main-content`.
2.  Call `unmount()` on the previous screen.
3.  Instantiate/Retrieve the new screen.
4.  Call `getLayoutConfig()` and update `#global-header` and `#global-footer`.
5.  Call `mount()` and append the result to `#main-content`.

## Consequences

### Positive

- **Guaranteed Visibility:** Action buttons in the footer will never be clipped, regardless of viewport size.
- **Consistent UX:** Every screen looks and feels part of the same system.
- **Clean DOM:** Only the active screen's elements exist in the DOM, improving performance and debugging.
- **Reduced Boilerplate:** Screens don't need to implement their own headers/footers/scrollers.

### Negative

- **Refactor Effort:** Requires rewriting `ScreenManager` and adapting all existing screens (`MissionSetup`, `Equipment`, `Barracks`, etc.) to the new interface.
- **State Preservation:** Unmounting screens destroys their DOM state (scroll position, input values). Screens must persist their state to a Manager (e.g., `CampaignManager`, `SessionState`) if it needs to survive navigation.

## Implementation Strategy

1.  **Phase 1 (Infrastructure):** Create `GameShell` class, updated `ScreenManager`, and `Screen` interface. Update `index.html` to the new skeleton.
2.  **Phase 2 (Migration):** Port screens one by one.
    - _Priority:_ `EquipmentScreen`, `MissionSetupScreen` (Fixes the immediate bugs).
    - _Secondary:_ `MainMenu`, `CampaignScreen`.
3.  **Phase 3 (Cleanup):** Remove old CSS and unused HTML from `index.html`.
