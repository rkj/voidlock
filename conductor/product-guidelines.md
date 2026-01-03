# Product Guidelines: Voidlock

## Tone & Voice

- **Gritty & Tactical:** Use concise, professional military-style language for UI labels, commands, and soldier status. Avoid flowery prose. The goal is to make the player feel like a squad commander processing high-stakes information.

## User Interface & Feedback

- **High Information Density:** Prioritize showing critical tactical data (HP, Cooldowns, Command Queues) in a structured, easily scannable format. The "Soldier List Panel" should be the primary source of squad health and status.
- **Visual Clarity:** Simulation events must have immediate visual feedback.
  - **Combat:** Bullet tracers and impact indicators must clearly show who is shooting whom.
  - **Logic Feedback:** Explicit status text like "Waiting for Door" or "Blocked" must be used to explain unit behavior that isn't immediately obvious from movement alone.
- **Color Palette:** Use a high-contrast palette suitable for a dark, sci-fi environment—ensuring that walls, units, and interactive elements (doors, objectives) are distinguishable even under Fog of War.

## Design Principles

- **Function over Form:** In the current prototype phase, UI elements should be functional and well-aligned before they are "beautiful."
- **Determinism First:** Any visual effect must be a direct representation of the underlying simulation state.
