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

## Technical Proposals

### Campaign State Interface

```typescript
export interface PersistentSoldier {
  id: string;
  name: string;
  archetypeId: string;
  hp: number;
  maxHp: number;
  xp: number;
  level: number;
  kills: number;
  missions: number;
  status: "Available" | "Wounded" | "Dead";
  recoveryTime?: number; // Missions remaining until available
}

export interface CampaignNode {
  id: string;
  type: "Combat" | "Elite" | "Event" | "Store" | "Boss" | "Exit";
  missionType: MissionType;
  difficulty: number;
  connections: string[]; // IDs of next nodes
  rewards: {
    scrap?: number;
    intel?: number;
    items?: string[];
  };
  visited: boolean;
}

export interface CampaignState {
  version: number;
  seed: number;
  currentSector: number;
  currentNodeId: string;
  scrap: number;
  intel: number;
  roster: PersistentSoldier[];
  squad: string[]; // IDs of soldiers currently in the active squad
  map: CampaignNode[];
  unlockedArchetypes: string[];
}
```

### Proposed Components

- **CampaignManager:** A singleton managing the `CampaignState`, handling node transitions, mission result processing, and persistence (Local Storage).
- **MissionGenerator:** Logic to create `MapDefinition`s with specific constraints (threat level, enemy density, objective type) based on the `CampaignNode` properties.
- **Campaign UI (Bridge/Map):**
  - **Node Map:** Visual representation of the `CampaignNode` graph.
  - **Barracks:** UI for managing the `roster`, viewing soldier stats, and selecting the `squad`.
  - **Shop:** UI for spending `scrap` on recruits or equipment.
