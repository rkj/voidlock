# ADR 0012: Theming System & Asset Pipeline

**Date:** 2026-01-03
**Status:** Proposed
**Epic:** [Visual Polish & Theming](xenopurge-gemini-7sgr)

## Context

Voidlock currently uses hardcoded colors, SVG icons, and visual styles scattered across multiple layers of the application:

- **Canvas Renderer**: Colors for walls, floors, doors, LOS, and units are hardcoded as strings (e.g., `"#00FFFF"`) in `Renderer.ts`.
- **DOM UI**: Styles and colors are hardcoded in `index.html`, `HUDManager.ts`, and individual screen classes (e.g., `BarracksScreen.ts`).
- **Tactical Icons**: SVGs are hardcoded as Base64 data strings in `Icons.ts`.
- **Assets**: Raw PNG assets exist in `NanoBanana Assets/` but are not integrated into a build pipeline.

This fragmentation makes it difficult to maintain visual consistency, implement new themes (e.g., "Industrial Ship" vs "Alien Hive"), or support high-DPI displays and different asset resolutions.

## Decision

We will implement a unified **Theming System** and an automated **Asset Pipeline**.

### 1. CSS Variable Foundation

A core set of CSS variables will be defined in a global stylesheet (or `index.html`) to serve as the single source of truth for the palette.

```css
:root {
  /* UI Colors */
  --color-bg: #1a1a1a;
  --color-surface: #111;
  --color-border: #333;
  --color-text: #eee;
  --color-primary: #0f0; /* Voidlock Green */
  --color-accent: #0af;
  --color-danger: #f00;

  /* Game World Colors (Canvas) */
  --color-wall: #00ffff;
  --color-floor: #111;
  --color-door-closed: #f00;
  --color-door-open: #ffd700;
  --color-los-visible: rgba(0, 255, 255, 0.1);
}
```

### 2. Centralized `ThemeManager`

A new `ThemeManager` utility in `src/renderer/` will coordinate theme application:

- **Canvas Access**: Provides a programmatic way for the `Renderer` to access CSS variable values as hex/rgba strings.
- **Dynamic Switching**: Supports switching themes by updating a class on the `<body>` or updating CSS variable overrides.
- **Asset Mapping**: Maps logical asset names (e.g., `soldier_heavy`) to processed asset URLs in `public/assets/`.

### 3. Decoupled Tactical Icons

Hardcoded SVGs in `Icons.ts` will be refactored:

- Icons will be moved to individual `.svg` files in `public/assets/icons/`.
- The `Renderer` and UI components will load icons via the `ThemeManager` or standard `<img>`/`background-image` CSS.
- Styling (colors) will be controlled via CSS filters or by injecting CSS variables into SVG symbols.

### 4. Automated Asset Pipeline

A Node.js script (`scripts/process_assets.ts`) will be introduced to:

- **Source**: Fetch raw PNGs from `NanoBanana Assets/`.
- **Process**: Perform cropping, resizing, and optimization (using `sharp` or similar).
- **Distribute**: Output standardized assets to `public/assets/`.
- **Manifest**: Generate an `assets.json` manifest used by the `ThemeManager` to preload and reference sprites.

### 5. Renderer & UI Refactor

- **Renderer.ts**: Replace all hardcoded color strings with calls to `ThemeManager.getColor()`.
- **UI Components**: Use CSS variables exclusively for styling. Inline styles should reference `--var` names where possible.

## Consequences

### Pros

- **Consistency**: Guarantees that the "Cyan" used on the map matches the "Cyan" used in the HUD.
- **Flexibility**: Enables "Night Mode", "High Contrast", and environment-specific color schemes.
- **Maintainability**: Centralizes visual configuration; changing a color in one place updates the entire app.
- **Asset Integrity**: Ensures all game assets are correctly sized and optimized for the web.

### Cons

- **Refactoring Effort**: Significant initial task to sweep the codebase for hardcoded values.
- **Runtime Lookup**: Small performance cost to resolve CSS variables for Canvas (mitigated by caching in `ThemeManager`).

## References

- [ADR 0008: Renderer & UI Separation](0008-renderer-ui-separation.md)
- [Epic: Visual Polish & Theming (xenopurge-gemini-7sgr)](https://github.com/voidlock/voidlock/issues/7sgr)
