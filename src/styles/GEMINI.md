# src/styles

This directory contains global and component-specific stylesheets for Voidlock.

## Files

- `main.css`: Core stylesheet containing variable definitions, layout utilities, and global component styles.
- `advisor.css`: Styles for the Advisor ("Mother") overlay.
- `tutorial.css`: Styles for the tutorial highlights and directives.

## CSS Theming (ADR 0061)

Voidlock uses CSS custom properties (variables) for all visual colors and styles to support dynamic theming.

### Usage Guidelines

- **Always use variables**: Use `var(--color-name)` instead of hardcoded hex/rgb values.
- **Themed overrides**: Themes are implemented by adding a class to `<body>` (e.g., `.theme-industrial`) and overriding variables within that scope.
- **Canvas resolution**: Use `ThemeManager.getColor('--var-name')` to resolve variables for canvas drawing.

### Key Variables

- `--color-primary`: Main interactive color (e.g., green).
- `--color-accent`: Secondary interactive color (e.g., blue).
- `--color-bg`: Base background color.
- `--color-surface`: Surface background for panels.
- `--color-surface-elevated`: Elevated surface for cards and modals.
- `--color-border`: Standard border color.
- `--color-text`: Primary text color.
- `--color-text-dim`: Dimmed/muted text color.

## Related ADRs

- [ADR 0061: CSS Theming via Variables](../../docs/adr/0061-css-theming-variables.md)
