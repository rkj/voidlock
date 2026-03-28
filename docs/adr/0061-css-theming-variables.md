# ADR 0061: CSS Theming via Variables

**Status:** Accepted
**Date:** 2026-03-27

## Context

Voidlock supports multiple visual themes (default, industrial, neon, retro) via CSS classes on `<body>`. However, many colors throughout the codebase are hardcoded as hex values (`#080`, `#0F0`), `rgb()`/`rgba()` literals, or inline styles — rather than using CSS custom properties. This creates two problems:

1. **Theme inconsistency** — changing themes doesn't affect hardcoded colors, so elements render with the wrong palette.
2. **Canvas rendering** — `<canvas>` elements cannot resolve `var()` syntax in `strokeStyle`/`fillStyle`. Colors must be resolved via `getComputedStyle()` before passing to the canvas API.

## Decision

### All visual colors must use CSS custom properties

Every user-facing color — in stylesheets, inline styles, and canvas drawing — must reference a CSS custom property defined in `:root` and overridden per theme.

### Naming convention

```
--color-{component}-{variant}
```

Examples:
- `--color-node-border`, `--color-node-cleared-bg`
- `--color-connection-active`, `--color-connection-default`
- `--color-hud-health`, `--color-hud-threat`

Opacity values that vary by theme use:
```
--{component}-{state}-opacity
```

### Canvas colors

For `<canvas>` elements, resolve CSS variables before use:

```typescript
const style = getComputedStyle(document.documentElement);
const color = style.getPropertyValue("--color-connection-active").trim();
ctx.strokeStyle = color;
```

### Theme structure

Each theme overrides variables in a body class selector:

```css
:root {
  --color-node-border: #888;
}
body.theme-industrial {
  --color-node-border: #cc8800;
}
body.theme-neon {
  --color-node-border: #ff00ff;
}
```

### What NOT to use

- Hardcoded hex/rgb/rgba values in `.css` files (except inside `:root` variable definitions)
- `var()` syntax in canvas `strokeStyle`/`fillStyle` (canvas cannot resolve it)
- Inline `style.color = "#hex"` in TypeScript (use CSS classes or resolved variables)

## Consequences

- One-time migration of ~35+ files with hardcoded colors.
- All themes will render consistently once migrated.
- New UI work must use CSS variables — enforced by code review.
- Canvas drawing code needs a helper or convention for resolving variables.
