# src/renderer/utils

This directory contains utility functions and classes specifically for the renderer.

## Files

- `UIUtils.ts`: Provides shared helper methods for common UI tasks.
  - `handleArrowNavigation`: Implements **Geometric 2D Navigation** (ADR 0037/Spec 8.3/9). Differentiates Arrow keys from Tab by using spatial proximity (`getBoundingClientRect`) and axis-specific constraints (`orientation`). Now respects `tabindex="-1"`, excluding such elements from geometric navigation.
- `FocusManager.ts`: Manages saving and restoring focus during UI re-renders to prevent focus loss.
