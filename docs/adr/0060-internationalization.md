# ADR 0060: Internationalization (i18n) System

**Status:** Accepted
**Date:** 2026-03-21

## Context

All user-facing strings in Voidlock are hardcoded across ~35 renderer files (~80-100 unique strings). The game's identity spec (`docs/spec/identity.md`) defines a corporate-themed vocabulary ("Assets" for soldiers, "Contracts" for campaigns, etc.) which is baked directly into source code.

Two needs have emerged:
1. **Multiple English voices** — a "standard" gaming vocabulary alongside the current corporate theme, selectable by the player.
2. **Localization** — Polish as the first non-English locale, with a structure that makes adding more languages trivial.

## Decision

### Lightweight custom i18n (no framework)

Consistent with ADR 0051 (Vanilla TSX, no framework), we implement a minimal custom i18n module rather than pulling in `i18next` or similar.

### Architecture

```
src/renderer/i18n/
  index.ts          — t() lookup, locale switching, type-safe keys
  keys.ts           — String key constants (enum or const object)
  locales/
    en-standard.ts  — Standard gaming English ("Campaign", "Settings", "Kills")
    en-corporate.ts — Current themed English ("Active Contracts", "Terminal", "Biological Neutralizations")
    pl.ts           — Polish translation
```

### String key convention

Keys use dot-separated namespaces matching the UI area:

```
menu.campaign          → "Campaign" | "Active Contracts" | "Kampania"
menu.custom_mission    → "Custom Mission" | "Simulated Operations" | "Misja niestandardowa"
screen.settings.title  → "Settings" | "Terminal Settings" | "Ustawienia"
command.move_to_room   → "Move To Room" | "Move To Room" | "Przejdź do pokoju"
hud.credits            → "Credits" | "Credits" | "Kredyty"
```

### Lookup: `t(key)` function

A single `t(key: StringKey): string` function resolves the current locale. It is synchronous (all locales are bundled, not lazy-loaded) to avoid async complexity in DOM updates.

### Locale selection

- Stored in `ConfigManager` under `locale` key.
- Default: `en-corporate` (preserves current behavior).
- Selectable in Settings screen.
- Change triggers a full screen re-render (no hot-swap of individual elements).

### HTML template

`src/index.html` strings are set on `DOMContentLoaded` via a `applyLocale()` call rather than being statically embedded.

### What is NOT localized

- Engine/simulation internals (no user-facing text)
- Console/debug logging
- Room structural labels (Corridor, Cargo Bay — these are schematic designators per identity.md)
- Menu command verbs that are already terminal-appropriate (Extract, Pickup, Hold — per identity.md section 7)

## Consequences

- Every renderer file with hardcoded strings needs migration (one-time, ~35 files).
- New strings must use `t()` — enforced by code review.
- Bundle size increases marginally (locale files are small plain objects).
- Test files that assert on string content will need updating to use `t()` or assert on keys.
