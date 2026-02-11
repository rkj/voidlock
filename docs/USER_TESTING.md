# Automated User Testing Protocol

This document serves as the master instruction for the **Visual & Logic Audit Agent**.

## Goal

To verify that the game's features are functional, the UI is aesthetically correct (no clipping, overlap, or glitches), and the experience matches the documented user stories.

## Workflow

1. **Initialize**: Navigate to the application at `http://localhost:5173` using `chrome-devtools`. The server is assumed to be already running.
1. **Load Story**: Select a user story from `docs/user_stories/`.
1. **Execute & Audit**:
   - Perform each step in the "Action List" using `click`, `fill`, etc.
   - **CRITICAL: Take a screenshot (`take_screenshot`) after EVERY significant UI transition or state change.**
   - Compare the actual UI against the "Visual Acceptance Criteria" in the story.
   - Inspect for:
     - Element clipping (text going out of boxes).
     - Overlapping elements.
     - Missing information described in specs.
     - Visual glitches (flickering, incorrect colors).
1. **Report & Remediate**:
   - If any step fails or a visual glitch is found:
     - **Create a Beads issue** (`bd create`) immediately.
     - Title: `[VUI] Title of the issue` (VUI = Visual UI).
     - Description: Implements `docs/user_stories/US_XXX.md`. Describe the mismatch/glitch. Mention the screenshot taken.
     - Priority: P2 (Standard) or P1 (Blocking).
1. **Finalize**: Provide a summary of all stories tested and the status of any newly created issues.

## Capabilities

- You MUST use `chrome-devtools` for all browser interactions.
- You MUST use `take_screenshot` to provide visual proof of success/failure.
- You MUST refer to `docs/spec/*.md` to resolve any ambiguity in behavior.

## User Story Template

Every story in `docs/user_stories/` follows this format:

```markdown
# US_XXX: [Title]

## Persona & Goal

[Description of who the user is and what they want to achieve.]

## Prerequisites

[State of the game before starting.]

## Action List

1. [Action] -> [Expected State Change]
2. ...

## Visual Acceptance Criteria

- [Constraint 1]
- [Constraint 2]
```
