# Components

This directory contains reusable UI components for the Voidlock renderer.

## Files

- `SquadBuilder.ts`: Handles the squad selection and deployment UI, including roster management and drag-and-drop slots. Used in the Mission Setup screen. Supports a maximum of 4 soldiers plus an optional VIP slot (auto-assigned in Escort missions, or manually added in Custom missions).

## Guidelines

- **Encapsulation**: Components should manage their own internal state and DOM elements where possible.
- **Context Injection**: Use `AppContext` to provide access to global managers and services.
- **Event Callbacks**: Use callback props for communicating state changes back to parent containers (like `GameApp`).
