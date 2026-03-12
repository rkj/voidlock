# Creative Identity: Voidlock — Terminal Assets

## 1. Core Fantasy

You are a **corporate operator** — a mid-level employee of a resource extraction conglomerate — remote-piloting biological assets (marines) through derelict hulls to secure proprietary technology. Your soldiers are on-site. You are not. You see what the terminal shows you. You issue commands through the corporate remote operations interface. When assets are lost, it's a line item.

This framing accomplishes three things:

1. **Justifies the UI**: Menus, keyboard commands, and top-down map view are the corporate terminal. This IS the interface. The player isn't abstracting away from a rich 3D world — they're seeing exactly what their character sees.
2. **Justifies autonomous soldiers**: The marines are physically present and competent. They explore, breach, and fight without waiting for your input. Your role is strategic intervention — redirecting, changing engagement policy, calling extraction. They don't need you. Until they do.
3. **Justifies the art style**: Simple 2D rendering, fog of war, minimal animation — these aren't budget constraints. This is a low-fidelity remote operations feed on corporate-issue hardware. The aesthetic IS the fiction.

## 2. Tone & Voice

### Corporate Sterile

All system-facing text (UI labels, status messages, tooltips) uses **clinical corporate language**. No heroics, no drama. Soldiers are "assets." Death is "asset loss." Objectives are "recovery targets." Extraction is "asset retrieval."

Examples:

| Current | Reframed |
|---------|----------|
| "Mission Complete" | "OPERATION CLOSED — Assets Retrieved" |
| "Mission Failed" | "OPERATION CLOSED — Total Asset Loss" |
| "Soldier Killed" | "ASSET LOST — Deducted from operational budget" |
| "Objective Collected" | "TARGET RECOVERED — Manifest updated" |
| "Extraction Zone" | "RETRIEVAL POINT" |
| "Give Up" | "ABORT OPERATION" |
| "Squad" | "ASSET ROSTER" |
| "Campaign" | "CONTRACT" |

### Advisor (MOTHER)

The advisor AI ("MOTHER" — a nod to Alien's MU-TH-UR 6000) uses a **detached, procedural tone**. She's helpful but not warm. She delivers information like a corporate onboarding module.

Tutorial example:
> "OPERATOR NOTICE: Asset deployment initialized. Your assigned biological assets have standing orders to explore and secure the operational area. Observe their progress on the tactical feed. Intervention commands are available via the right-panel terminal. Quarterly performance review pending."

Combat advisor:
> "ALERT: Hostile biological contact detected. Assets are engaging per standard ROE. Threat index updated. Note: asset replacement costs will be reflected in your next budget cycle."

Extraction:
> "NOTICE: Recovery target secured. Initiate asset retrieval via EXTRACT command. Reminder: incomplete retrievals incur a 30% operational surcharge."

### Narrative Events

Campaign events keep the corporate wrapper but let dark humor bleed through:

| Current | Reframed |
|---------|----------|
| "Derelict Ship" | "SALVAGE OPPORTUNITY — Unregistered Vessel" |
| "Search for Supplies" | "Authorize Scavenging Operation" |
| "Distress Signal" | "UNSCHEDULED ASSET RECOVERY — Beacon Detected" |
| "Attempt Rescue" | "Authorize Recovery (NOTE: may affect insurance premiums)" |
| "Black Market" | "INFORMAL PROCUREMENT CHANNEL" |

## 3. Visual Identity

### Terminal Aesthetic

The game is presented as a **corporate remote operations terminal**. The existing green-on-dark palette (`#0f0` primary, `#1a1a1a` background) already supports this. Enhancements:

**CRT Effects (CSS overlay, no renderer changes):**
- Scanline overlay: horizontal lines at 2px intervals, 5-8% opacity
- Subtle phosphor glow on primary-colored text (green/amber text-shadow)
- Very subtle screen curvature via border-radius on the outer container
- Optional: slight flicker on state transitions (0.02s opacity pulse)

**Color Modes:**
- **Green Phosphor** (default): `#0f0` primary — classic terminal
- **Amber Phosphor** (alt): `#ffb000` primary — warm CRT variant
- These map to the existing theme system (`docs/spec/ui.md` Section 8.1 "Environment Theme")

**Typography:**
- Monospace throughout for data readouts (already largely in place)
- ALL CAPS for system messages, status labels, alert text
- Mixed case for narrative/advisor text only

**UI Chrome:**
- Thin border frames around panels (single-pixel, primary color)
- Corner decorations suggesting terminal window chrome (optional: `┌─┐` style)
- Status bar / header styled as terminal title bar: `VOIDLOCK REMOTE OPS TERMINAL v0.xxx.xx — OPERATOR: [callsign]`

### Map Rendering

The canvas tactical view already reads as a terminal feed. Enhancements to consider:
- Grid overlay with subtle coordinate labels
- Unit markers as simple geometric shapes with designator labels
- "FEED LOST" overlay on fully fogged areas instead of black
- Slight static/noise at fog-of-war boundaries

### Audio Direction (future)

- CRT hum ambient
- Mechanical keyboard clicks on menu navigation
- Harsh alert tones for threats (not orchestral, think radar pings)
- Radio static on advisor messages

## 4. Marketing Copy

### Tagline

**"Your assets are expendable. Your quarterly review is not."**

### Short Pitch (Steam capsule / itch.io)

> Blind corners. Fog of war. A 60-second delay on the extraction shuttle.
>
> Voidlock is a real-time tactical meatgrinder where you remote-pilot marines through derelict hulls to recover corporate assets. Your soldiers explore and fight autonomously — your job is knowing when to intervene, when to redirect, and when to cut your losses.
>
> Every lost marine is a budget deduction. Every recovered artifact is a bonus. The swarm doesn't care about your quarterly targets.

### Long Pitch (Steam "About This Game")

> **You are not a hero. You are a middle manager.**
>
> Somewhere in a corporate operations center, you sit at a green-phosphor terminal. On the other end of a satellite uplink, your assigned biological assets — marines, technically — are breaching a derelict hull crawling with hostile organisms.
>
> They're trained. They're competent. They explore, open doors, and engage hostiles without your input. But they're not smart enough to know when to fall back, when to change tactics, when to abandon the objective and run.
>
> That's your job.
>
> **VOIDLOCK** is a deterministic real-time tactics game with autonomous squad AI. Issue commands through a menu-driven terminal interface. Change engagement rules. Redirect squads. Trigger extraction before the swarm overruns the corridor. Or don't — replacement assets are cheaper than you'd think.
>
> **Features:**
> - **Autonomous Marines**: Your soldiers think for themselves. You intervene when it matters.
> - **Terminal Interface**: Keyboard-driven menu commands. No click-to-move. This is a remote operations feed, not a video game.
> - **Deterministic Simulation**: Every run is reproducible. Same seed, same outcome. Blame yourself, not RNG.
> - **Procedural Derelicts**: Each hull is different. Tight corridors, blind corners, chokepoints.
> - **Fog of War**: You see what your assets see. Nothing more.
> - **Roguelite Contracts**: Multi-mission campaigns with persistent roster, equipment, and budget management.
> - **The Quarterly Review**: Lose too many assets and your operational privileges get... reviewed.

### One-liner Variations

- "Autonomous squad tactics through a corporate terminal."
- "Your soldiers don't need you. Until they do."
- "Real-time tactics for people who think Aliens was a workplace safety video."

## 5. README Structure

The README should function as a landing page:

1. **Title**: "Voidlock — Terminal Assets" + tagline (one line)
2. **Screenshot** (terminal aesthetic, in-mission)
3. **Pitch** (3 sentences max — the short pitch)
4. **Key Features** (bulleted, in-universe language)
5. **Play Now** (link to hosted version if applicable)
6. **Development** (collapsed/minimal — install, dev, test commands)
7. **Documentation** (links to specs)

## 6. Tutorial Reframe

The tutorial (ADR 0058) step sequence and mechanics are unchanged. Only the narrative wrapper changes:

- **Advisor portrait**: MOTHER (corporate AI)
- **Step 1 message**: "OPERATOR NOTICE: Asset deployment initialized. Your assigned unit has standing orders to explore and secure. Observe the tactical feed."
- **Step 4 message**: "ALERT: Hostile contact. Asset engaging per standard ROE. Threat index updated. Asset replacement costs: 2,400 credits."
- **Step 5 message**: "TUTORIAL: Remote intervention commands are available. Use the terminal to modify engagement policy. Select ENGAGEMENT > IGNORE to test override capability."
- **Step 7 message**: "NOTICE: Recovery target located in adjacent compartment. Use ORDERS > MOVE TO ROOM to redirect asset. Terminal displays room designators when in targeting mode."
- **Step 9 message**: "TARGET RECOVERED. Initiate asset retrieval. All deployed assets must reach the retrieval point. Reminder: abandoned assets are written off at full replacement cost."

## 7. Naming Conventions

### In-Game Terminology

| Generic | Voidlock Term |
|---------|--------------|
| Player | Operator |
| Soldier | Asset / Unit |
| Squad | Roster / Deployed Assets |
| Enemy | Hostile / Contact |
| Mission | Operation |
| Campaign | Contract |
| Equipment | Loadout |
| Health | Integrity |
| Death | Asset Loss |
| Objective | Recovery Target |
| Extraction | Retrieval |
| Score | Operational Rating |
| Scrap (currency) | Budget / Credits |
| Threat Level | Threat Index |
| Game Over | CONTRACT TERMINATED |

### Do NOT Rename

Some things keep their current names for clarity:
- Fog of War (universally understood)
- Engagement / Orders / Pickup / Extract (menu labels — these are terminal commands, they should sound like terminal commands)
- Room names (Corridor, Cargo Bay, etc. — these are structural labels on a schematic)
