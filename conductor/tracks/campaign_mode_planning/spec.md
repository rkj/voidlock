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
export interface CampaignSoldier {
  id: string;
  name: string;
  archetypeId: string;
  hp: number;
  maxHp: number;
  xp: number;
  level: number;
  kills: number;
  missions: number;
  status: "Healthy" | "Wounded" | "Dead";
  equipment: EquipmentState;
  recoveryTime?: number; // Missions remaining until available
}

export interface CampaignNode {
  id: string;
  type: "Combat" | "Elite" | "Shop" | "Event" | "Boss";
  status: "Hidden" | "Revealed" | "Accessible" | "Cleared";
  difficulty: number;
  mapSeed: number;
  connections: string[]; // IDs of child nodes in the DAG
  position: Vector2;
  missionType?: MissionType;
}

export interface CampaignState {
  version: string;
  seed: number;
  rules: GameRules;
  scrap: number;
  intel: number;
  currentSector: number;
  currentNodeId: string | null;
  nodes: CampaignNode[];
  roster: CampaignSoldier[];
  history: MissionReport[];
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
