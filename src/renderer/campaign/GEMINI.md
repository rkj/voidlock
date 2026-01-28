# Campaign Renderer

This directory contains the campaign management bridge for the renderer.

## Files

- `CampaignManager.ts`: A bridge to the `src/engine/campaign/CampaignManager.ts` singleton. It initializes the manager with a `LocalStorageProvider` for use in the browser.
- `MetaManager.ts`: A bridge to the `src/engine/campaign/MetaManager.ts` singleton. It initializes the manager with a `LocalStorageProvider` for use in the browser.

## Subdirectories

- `tests/`: Tests for the campaign bridge.
