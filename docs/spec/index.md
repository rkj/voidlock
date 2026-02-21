# Voidlock Specifications

**Version:** 1.3
**Core Concept:** Single-player, Real-Time with Pause (RTwP) tactical squad combat in a claustrophobic spaceship environment.

This document serves as the **Game Design Document (GDD)** and the index for all detailed specifications.

______________________________________________________________________

## 0. Documentation Standards (Meta-Spec)

The files in `docs/spec/` are **Living Documents**, not Changelogs.

1.  **Current State Only:** They describe the system **as it exists (or is actively being built)**.
2.  **No History:** Do not document "Removed" features or "Old" behaviors. If a feature is removed, delete its section.
3.  **No Code:** Specs describe **Behavior** and **Rules**, not Implementation details (Classes, Functions).
4.  **Source of Truth:** If the Code contradicts the Spec, **the Code is a Bug** (unless the Spec is outdated, in which case update the Spec first).

______________________________________________________________________

## 1. Scope & Design Pillars

### 1.1 In Scope

- **Engine:** Deterministic, tick-based simulation running in a Web Worker.
- **Visuals:** 2D Top-down, Grid-based, "Shared Wall" rendering via HTML5 Canvas.
- **Loop:** Configure Squad -> Load Map -> Real-Time Tactical Combat -> Extract or Die.
- **Campaign:** Roguelite progression, Sector Map, Economy (Scrap), and Roster Management.
- **Modding:** "Content Packs" (JSON) strictly define stats, maps, and logic parameters.
- **AI Support:** First-class support for bot players via a JSON observation/command protocol.

### 1.2 Out of Scope

- Multiplayer networking (Local only).
- Complex Frameworks (React/Vue) — strictly Vanilla TS + Vite.
- 3D Physics.

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

  - Command Protocol (MOVE, STOP, HOLD, EXTRACT)
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
