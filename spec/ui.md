# User Interface & Experience

## 8) UI/UX requirements (web)

### 8.1 Screen Flow Architecture

The application is divided into distinct screens to reduce UI clutter and improve flow.

1.  **Main Menu (Welcome Screen)**
    - **Title**: "Xenopurge"
    - **Credits**: Author/Version info.
    - **Navigation**:
      - "Campaign" -> Go to Campaign Screen.
      - "Custom Mission" -> Go to Mission Setup Screen.
      - "Load Replay" -> Import replay JSON.
    - _Note_: Pressing `ESC` from other screens (except Mission) returns here (or to previous screen).

2.  **Mission Setup Screen** (formerly Config Screen)
    - **Map Configuration**:
      - Generator Type (Procedural, TreeShip, Static).
      - Seed Input / Randomize.
      - Map Size (Width/Height).
      - Static Map Import (Text/File/ASCII).
    - **Game Options**:
      - Fog of War, Debug Overlay, Agent Control, LOS Visualization toggles.
      - **Game Speed Control**:
        - **Slider Range**: 0.05x (Active Pause) to 5.0x (Fast Forward). Default 1.0x.
        - **Active Pause**: Speed 0.05x acts as "Active Pause", allowing commands to be issued while time moves very slowly.
        - **In-Game Access**: This control must be accessible during a mission.
        - **Controls**:
          - **Spacebar**: Toggles between "Active Pause" (0.05x) and the last used speed.
          - **UI Button**: A dedicated button (Play/Pause icon) in the UI should also toggle this state.

- **Command Set Updates:**
  - `ENGAGE/IGNORE Toggle`: Units can be toggled between 'ENGAGE' (Stop & Shoot) and 'IGNORE' (Run) policies. This toggle should be easily accessible in the command menu.
  - **Squad Configuration**:
    - Select archetypes/count.
  - **Actions**:
    - "Launch Mission" -> Starts Engine, switches to Mission Screen.
    - "Back" -> Main Menu.

3.  **Mission Screen** (Active Gameplay)
    - **Main View**: Canvas/WebGL rendering of the game world.
    - **Top Left Overlay**: Display current Map Seed (e.g., "Seed: 12345").
    - **Left Panel**: Squad List (Health, Status) + Quick Commands.
    - **Right Panel**:
      - **Objectives List**: Current status of mission objectives.
        - **Format**: Unified visual component for both active gameplay and Game Over summary.
        - **Style**: `[Icon] [Objective Kind]`.
        - **Icons**: '○' (Pending), '✔' (Completed), '✘' (Failed).
        - **Coordinates**: Hidden by default to prevent meta-gaming. Visible **ONLY** if the Debug Overlay is enabled.
        - **Map Rendering**: Objectives at the Extraction Zone (e.g., "Extract Squad") must NOT render a separate "Objective" icon on the map, as the Extraction Zone itself is already visualized.
      - **Extraction Status**: Location/Progress (Coordinates subject to the same visibility rules as objectives).
      - **Threat Meter**: Visual indicator of Director intensity.
    - **Bottom Panel**: Timeline/Event Log.
    - **Input**:
      - `ESC`: Opens **Pause Overlay** (Resume / Abort Mission).

### 8.3 Control Scheme & Keyboard Navigation

The game must be fully playable via keyboard using a strict hierarchical command menu.

- **Menu Hierarchy (Implemented):**
  - **Level 1 (Action):**
    - `1`: Move
    - `2`: Stop (Halts unit and disables AI)
    - `3`: Engagement (Toggle Engage/Ignore)
    - `4`: Collect (Objectives) - _Disabled if no items visible_
    - `5`: Extract - _Disabled if not at extraction_
  - **Level 2 (Target/Mode Selection):**
    - **Move:** Select Room (Labeled A-Z, 0-9) or specific cell. Rooms are filtered by discovery state.
    - **Engagement:** `1`: Engage (Stop & Shoot), `2`: Ignore (Run).
    - **Collect/Extract:** Context-aware immediate execution or selection if multiple targets.
  - **Universal Back:** option `0` or `ESC` always goes back one level.
- **Mouse Support:**
  - Full mouse support implemented via clickable menu items and map overlays.
  - Includes a "0. BACK" button in submenus for mouse-only navigation.
- **Workflow:** Action -> [Target/Mode] -> Unit(s).
- **Input Handling:**
  - `1-9`: Select menu option.
  - `ESC`: Cancel/Back to previous menu level.
  - Mouse: Clicking a menu item or a target cell/unit is a secondary shortcut that executes the selection for that specific level.

### 8.4 UI Layout Reorganization

The UI must be optimized for visibility and information density, utilizing the full width of the screen.

- **Top Bar (Header):** Fixed height (40px). Displays Game Time, Status, Seed, Version, and the **Threat Meter**.
- **Soldier Bar (Sub-header):** Full-width strip below the top bar (Height: 56px). Displays all soldiers in a horizontal layout.
  - **Layout:** Items must fit within the container **without scrolling** (no overflow). Use flexible sizing to fill available width.
  - **Soldier Card:** Fixed or flexible width to prevent text wrapping. Visual stability is key—content updates (e.g., status text changes) must NOT cause layout jitter (box resizing).
  - **Selection:** Individual cards show HP and status but **no buttons**. Clicking a card is a shortcut for selecting that unit in the menu flow (Level 3).
- **Command Panel (Right):** Fixed width (300px). Displays the current level of the **Hierarchical Command Menu**. Visual feedback must be crystal clear about which level the user is currently in.
- **Main Simulation Area:** Flex container containing the Game Canvas. Centered. Overlay numbers appear on the canvas during target/unit selection.
- **Game Over Summary:** Upon Win/Loss, a summary panel/popup must appear (or replace the Right Panel) showing:
  - Result (Mission Accomplished / Squad Wiped).
  - Statistics: Time Elapsed, Aliens Purged, Casualties.
  - Action: "Back to Menu" button. This state must be fully cleared when a new mission starts.

### 8.5 Mission Configuration

- **Spawn Points:** The number of initial spawn points (vents/entry points for enemies) must be configurable in the Mission Setup screen (Range: 1 to 10) and **strictly adhered to** by the generator.
- **Strict Placement Rules:**
  - **Spawn Points:** Must ONLY be placed in rooms, never in corridors.
  - **Squad vs Enemy Spawns:** A room containing a squad spawn point MUST NOT contain an enemy spawn point, and vice-versa. They must be placed in mutually exclusive rooms.
  - **Objectives & Hive:** Must ONLY be placed in rooms, never in corridors.
  - **Corridors:** Must remain clear of all static mission entities to maintain the "frame" integrity.

### 8.2 Debug affordances (non-negotiable for balancing)

- Toggle “show all” (disable fog) for quick iteration.
- Heatmaps/overlays:
  - Spawn intensity
  - LOS cones (Visualization must be an overlay from individual characters/enemies to distinguish their specific LOS, rather than a generic grid painting)
  - Navmesh/path display
- Deterministic replay:
  - Export `(seed, config, commandStream)` as JSON
  - Import to replay exact run
