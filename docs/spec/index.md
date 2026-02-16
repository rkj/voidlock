# Voidlock Specifications

**Version:** 1.2
**Core Concept:** Single-player, Real-Time with Pause (RTwP) tactical squad combat in a claustrophobic spaceship environment.

This document serves as the **Game Design Document (GDD)** and the index for all detailed specifications.

______________________________________________________________________

## 1. Scope & Design Pillars

### 1.1 In Scope

- **Engine:** Deterministic, tick-based simulation running in a Web Worker.
- **Visuals:** 2D Top-down, Grid-based, "Shared Wall" rendering via HTML5 Canvas.
- **Loop:** Configure Squad -> Load Map -> Real-Time Tactical Combat -> Extract or Die.
- **Modding:** "Content Packs" (JSON) strictly define stats, maps, and logic parameters.
- **AI Support:** First-class support for bot players via a JSON observation/command protocol.

### 1.2 Out of Scope

- Multiplayer networking (Local only).
- Meta-progression (XP, Campaign map, Loot inventory).
- Complex Frameworks (React/Vue) — strictly Vanilla TS + Vite.

______________________________________________________________________

## 2. Detailed Specifications

Agents and developers should consult the specific files below for implementation details:

- **[Simulation & Protocol](simulation.md)**

  - Game Loop Architecture (Tick-based)
  - Determinism & PRNG
  - Engine ↔ Client Protocol (JSON)
  - Fog of War Logic
  - Persistence

- **[World Model & Map](map.md)**

  - The Grid (Shared Walls / Edges)
  - Map Generation & Content Packs
  - ASCII Map Representation
  - Map Viewer Utility

- **[Missions](mission.md)**

  - Mission Types & Win/Loss Conditions
  - Success/Failure Criteria
  - Objectives & Special Rules

- **[Units & Combat](combat_units.md)**

  - Unit Stats (Speed, Health)
  - Weapon & Accuracy Model (Angular Dispersion)

- **[Enemies](enemies.md)**

  - Enemy Archetypes & Points
  - Aggro & Roaming Logic

- **[Command System & AI](commands.md)**

  - Command Protocol (MOVE, STOP, ATTACK)
  - Specialized Behaviors (Escort, Overwatch)

- **[AI & Game Logic](ai.md)**

  - Enemy AI Behaviors
  - Soldier Logic (Engagement, Self-preservation)
  - The Director (Spawning Algorithm)

- **[Items & Abilities](items.md)**

  - Global Inventory (Pool)
  - Commander Abilities (Instant)
  - Tactical Actions (Timed/Unit-Driven)

- **[User Interface](ui.md)**

  - Screen Flow & Layout
  - Control Scheme (Keyboard/Mouse)
  - Mission Configuration

- **[Campaign & Meta](campaign.md)**

  - Sector Map Logic
  - Economy (Scrap) & Roster Management
