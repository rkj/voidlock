# Campaign Mode Planning

## Overview
The Campaign Mode aims to provide a structured progression for players, linking individual missions with a story, persistent squad management, and increasing difficulty.

## Core Questions for Design Session
1. **Story & Setting:**
   - What is the overarching goal of the campaign? (e.g., clearing a sector, reaching a specific destination, investigating a distress signal).
   - Will there be narrative branching or fixed paths?

2. **Progression System:**
   - **Persistent Squad:** Do soldiers gain experience, skills, or improved stats over time?
   - **Permadeath:** If a soldier dies in a mission, are they gone forever? Can they be replaced?
   - **Unlocks:** What can players unlock? (New archetypes, weapons, utility items, ship upgrades).

3. **Mission Structure:**
   - How are missions selected? (A galaxy map, a list of available contracts, a linear sequence).
   - Are there "boss" missions or special event missions?
   - Dynamic Difficulty: How does the threat scale across the campaign?

4. **Resource Management:**
   - Is there a "meta-currency"? (e.g., Credits, Scraps, Intel).
   - What is it used for? (Recruiting, healing, buying gear).

5. **Interface:**
   - How does the Campaign UI look? (A "Bridge" view, a star map, a simple menu).

## Proposed Components
- **Campaign State:** A persistent JSON state tracking progress, squad, resources, and unlocked content.
- **Mission Generator:** Logic to create missions with specific constraints based on campaign progress.
- **Meta-UI:** New screens for squad management, mission selection, and upgrades.
