# US_001: The New Commander

## Persona & Goal

As a new player, I want to start a fresh Ironman campaign so that I can experience the highest level of challenge and consequence.

## Prerequisites

- Main Menu loaded.
- No active campaign (or willing to reset).

## Action List

1. Click "Reset Data" -> Modal appears confirming destruction.
2. Click "Confirm" in Modal -> Application reloads to clean state.
3. Click "Campaign" -> Sector Map screen opens.
4. Click "New Campaign" (if prompt exists) -> New Campaign Wizard opens.
5. Click the "Ironman" difficulty card -> Card is highlighted.
6. Observe "Tactical Pause" checkbox -> Checkbox must be UNCHECKED and DISABLED.
7. Click "Start Campaign" -> Transition to Sector Map (Bridge View).

## Visual Acceptance Criteria

- Ironman card displays unique "Hard" styling/icons.
- Hovering the disabled Pause checkbox shows a tooltip explaining why it is disabled.
- Sector Map rank 1 nodes are visible and clickable.
- Global Resource Header (Top Right) shows 150 Scrap and 0 Intel.
