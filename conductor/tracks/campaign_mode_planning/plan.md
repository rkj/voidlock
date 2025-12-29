# Plan: Campaign Mode Planning

## Goal
Establish the technical and narrative foundation for the Xenopurge Campaign Mode.

## Proposed Strategy

### 1. Narrative & Structure
- **Setting:** A derelict starship ("The Xenopurge") or a sector of space with multiple derelicts.
- **Goal:** Reach the core of the ship / Clear the sector.
- **Pathing:** Node-based map (similar to FTL or Slay the Spire) to provide player agency while maintaining a controlled progression.

### 2. Squad Progression
- **Soldier Stats:** Basic stats (Accuracy, Health, Speed) that can be improved.
- **Classes/Archetypes:** Unlockable or recruitable specialists (e.g., Heavy, Scout, Medic).
- **Equipment:** Persistent inventory. Weapons and items found in missions are kept if the squad extracts.

### 3. Resource Management
- **Scrap:** Main currency found during missions. Used for recruitment, repairs, and gear.
- **Intel:** Secondary currency used to reveal mission details or bypass nodes.

### 4. Implementation Steps (Phased)

#### Phase 1: Campaign State & Persistence
- [ ] Implement `CampaignManager.ts` in `src/engine/managers/`.
- [ ] Define `CampaignState` and related interfaces in `src/shared/types.ts` (or a new `src/shared/campaign_types.ts`).
- [ ] Implement local storage persistence for campaign state.
- [ ] Write unit tests for state management (save/load/initialize).

#### Phase 2: Campaign Map Generation
- [ ] Implement procedural node-map generator (e.g., layered graph).
- [ ] Implement node-to-mission mapping (difficulty scaling).
- [ ] Create basic visualizer for the campaign map (could start as a CLI tool or a simple debug UI).

#### Phase 3: Squad Management
- [ ] Implement `Barracks` logic: recruiting, renaming, and assigning soldiers to squad.
- [ ] Implement persistent health/wounded system.

#### Phase 4: Integration
- [ ] Integrate mission results back into campaign state (deaths, rewards, XP).
- [ ] Update `Main Menu` to support campaign entry.

## Questions for Discussion

1. **Permadeath:** Should soldiers be permanently lost, or just "wounded" and out of action for X missions? (Proposal: Permadeath for narrative weight, but allow recruitment).
2. **Procedural vs. Hand-crafted:** To what extent should campaign missions be procedural? (Proposal: Procedural layout, but hand-crafted "encounters" or objective sets).
3. **Extraction Mechanics:** How does extraction affect campaign progress? Is partial extraction allowed? (Proposal: Only extracted units and loot are saved. Total wipe = mission fail, but campaign continues if other soldiers are in roster).
