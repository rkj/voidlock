# Task Context: xenopurge-gemini-ph17

## Objective
Externalize hardcoded icons and styles into files and implement a `ThemeManager` as defined in ADR 0012.

## Requirements

### 1. Icons Refactor
-   Extract all SVGs from `src/renderer/Icons.ts` into individual `.svg` files in `public/assets/icons/`.
-   Use descriptive names (e.g., `exit.svg`, `spawn.svg`, `health.svg`).
-   Update `Icons.ts` to export these URLs instead of Base64 strings, or refactor components to use them directly.

### 2. Centralized CSS
-   Create `src/styles/main.css`.
-   Define `:root` CSS variables for the color palette as defined in ADR 0012 (e.g., `--color-wall`, `--color-primary`).
-   Move common UI styles from `index.html` and screen classes to this CSS file.
-   Include `main.css` in `index.html`.

### 3. ThemeManager (`src/renderer/ThemeManager.ts`)
Implement a `ThemeManager` class with the following capabilities:
-   `getColor(varName: string): string`: Resolves a CSS variable to its current hex/rgba value (useful for the Canvas `Renderer`).
-   `getIconUrl(iconName: string): string`: Returns the URL for a standard icon.
-   `setTheme(themeName: string): void`: Switches themes by adding/removing classes from the `<body>`.

### 4. Implementation
-   Update `src/renderer/Renderer.ts` to use `ThemeManager.getColor()` for its drawing operations (walls, doors, LOS).
-   Update `HUDManager.ts` and screens to use CSS classes and variables.

## Verification
-   Ensure icons still render correctly in the HUD and on the map.
-   Verify that changing a CSS variable in `main.css` correctly updates both the DOM UI and the Canvas rendering.
-   Run all tests and ensure the build succeeds.
