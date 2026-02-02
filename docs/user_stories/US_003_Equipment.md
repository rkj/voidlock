# US_003: Armory Readiness

## Persona & Goal

As a Commander, I want to equip my best soldiers with advanced gear before a mission so that I maximize their survival chance.

## Prerequisites

- Sector Map active.
- Soldier selected in the roster.
- Scrap available for purchases.

## Action List

1. Click a Rank 1 node on the Sector Map -> Mission Setup (Ready Room) opens.
2. Observe the "Campaign Context Header" -> Displays Difficulty, Mission Number, and Sector.
3. Click on a Deployment Slot to focus a soldier -> Soldier Inspector opens (within the Setup screen).
4. Click the "Engineering" or "Armory" tab/section -> List of weapons and items appears.
5. Click a "Pulse Rifle" (if not owned) -> Scrap is deducted, item is equipped to Right Hand.
6. Observe Weapon Stats (Damage, Range, Fire Rate) -> Displayed as icons.
7. Click "Launch Mission" -> Transition to tactical gameplay.

## Visual Acceptance Criteria

- Equipment list shows prices in Green (Scrap).
- Equipping an item provides immediate visual feedback on the "Paper Doll" slots.
- Total Mission Scrap/Intel remains visible in the Campaign Shell header.
- Launch button is disabled if fewer than 1 healthy soldier is assigned.
