# User Interface & Experience

## 8) UI/UX requirements (web)

### 8.1 Screen Flow Architecture

The application is divided into distinct screens to reduce UI clutter and improve flow.

1. **Main Menu (Welcome Screen)**
   - **Title**: "Xenopurge"
   - **Credits**: Author/Version info.
   - **Navigation**:
     - "Campaign" -> Go to Campaign Screen.
     - "Custom Mission" -> Go to Mission Setup Screen.
     - "Load Replay" -> Import replay JSON.
   - _Note_: Pressing `ESC` from other screens (except Mission) returns here (or to previous screen).

1. **Mission Setup Screen** (formerly Config Screen)
   - **Map Configuration**:
     - Generator Type (Procedural, TreeShip, Static).
     - Seed Input / Randomize.
     - Map Size (Width/Height).
     - Static Map Import (Text/File/ASCII).
   - **Game Options**:
     - Fog of War, Debug Overlay, LOS Visualization toggles.
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

2b. **Squad Equipment Screen**
\- **Access**: Available from "Mission Setup" (Custom) and "Campaign Hub" (Between missions).
\- **Layout**:
\- **Left Panel (Soldier List)**: Select a soldier to configure.
\- **Center Panel (Paper Doll)**: Slots for Right Hand, Left Hand, Body, Feet.
\- **Soldier Stats**: Distinct section displaying ONLY innate stats (HP, SPD, Base ACC).
\- **Weapon Stats**: Distinct section displaying aggregate weapon performance (Total ACC, DMG, FR/ASP, Range).
\- **Separation**: These two blocks must be visually distinct to avoid confusion (e.g., "Damage" is NOT a soldier stat).
\- **Right Panel (Armory)**: Tabbed list of available equipment (Weapons, Armor) and Squad Items (Grenades, Medkits).
\- **Item Display**: Each item in the list MUST display:
\- **Name** & **Price**.
\- **Key Stats**: Using the same icons as the Soldier Card (DMG, RNG, FR).
\- **Tooltips**: Hovering an item MUST display a detailed description (flavor text + full stats), especially for Global Supplies (e.g., "Scanner: Reveals map in 15 tile radius").
\- **Functionality**:
\- **Initialization**: When opening this screen, the slots MUST be pre-populated with the soldier's currently assigned equipment. It must NEVER default to empty hands unless the soldier is actually unarmed.
\- Assign weapons/armor to specific soldier slots.
\- Allocate global items (e.g., "Take 3 Grenades") to the mission inventory pool.

3. **Mission Screen** (Active Gameplay)
   - **Main View**: Canvas/WebGL rendering of the game world.
   - **Top Left Overlay**: Display current Map Seed (e.g., "Seed: 12345").
   - **Left Panel**: Squad List (Health, Status) + Quick Commands.
   - **Right Panel**:
     - **Objectives List**: Current status of mission objectives.
       - **Format**: Unified visual component for both active gameplay and Game Over summary.
       - **Style**: `[Icon] [Objective Kind]`. (e.g. "✔ Recover Artifact").
       - **Text Content**: Must NOT display status text like "(Pending)" or "(Completed)". The icon serves this purpose.
       - **Icons**: '○' (Pending), '✔' (Completed), '✘' (Failed).
       - **Accessibility**: Icons must include a standard HTML `title` attribute (tooltip) describing the state (e.g., "Pending", "Completed") for accessibility.
       - **Coordinates**: The text `at (x,y)` MUST be hidden by default to prevent meta-gaming. It should be visible **ONLY** if the Debug Overlay is enabled.
       - **Map Rendering**: Objectives at the Extraction Zone (e.g., "Extract Squad") must NOT render a separate "Objective" icon on the map, as the Extraction Zone itself is already visualized.
     - **Extraction Status**: Location/Progress (Coordinates subject to the same visibility rules as objectives).
     - **Threat Meter**: Visual indicator of Director intensity.
   - **Bottom Panel**: Timeline/Event Log.
   - **Input**:
     - `ESC`: Opens **Pause Overlay** (Resume / Abort Mission).

### 8.3 Control Scheme & Keyboard Navigation

The game must be fully playable via keyboard using a strict hierarchical command menu.
For detailed Command behaviors, see **[Command System & AI](commands.md)**.

- **Menu Hierarchy (Implemented):**
  - **Level 1 (Action):**
    - `1`: Orders (Move, Explore, Hold, Escort)
    - `2`: Engagement (Toggle Engage/Ignore)
    - `3`: Use Item
    - `4`: Pickup (Loot)
    - `5`: Extract
  - **Level 2 (Orders):**
    - `1`: Move To Room... (Select Room ID)
    - `2`: Overwatch Intersection... (Select Intersection)
    - `3`: Explore (Autonomous)
    - `4`: Escort... (Select Friendly Unit)
    - `5`: Hold Position
  - **Level 3 (Target Selection):**
    - **Move To Room:** Select Room (Mapped 1-9, A-Z).
    - **Overwatch Intersection:** Select Intersection Point (Mapped 1-9).
    - **Escort:** Select Unit (Mapped 1-4).
  - **Universal Back:** `Q` or `ESC` always goes back one level.
- **Mouse Support:**
  - Full mouse support implemented via clickable menu items and map overlays.
  - Includes a "0. BACK" button in submenus for mouse-only navigation.
- **Queueing:**
  - Hold `Shift` while issuing a command to **Append** to queue.
  - Default behavior (No Shift) **Replaces** current queue.
- **Workflow:** Action -> [Target/Mode] -> Unit(s).
- **Input Handling:**
  - `1-9`: Select menu option.
  - `Q` / `ESC`: Cancel/Back to previous menu level.
  - `Shift`: Queue modifier.
  - Mouse: Clicking a menu item or a target cell/unit is a secondary shortcut that executes the selection for that specific level.

### 8.4 UI Layout Reorganization

The UI must be optimized for visibility and information density, utilizing the full width of the screen.

- **Top Bar (Header):** Fixed height (40px). Displays Game Time, Status, Seed, Version, and the **Threat Meter**.
  - **Soldier Bar (Sub-header):** Full-width strip below the top bar (Height: 56px). Displays all soldiers in a horizontal layout.
    - **Reusable Stat Component**: The icon-based stat display used here MUST be extracted and reused in:
      - **Squad Selection Screen**: Replacing the text-based stats.
      - **Equipment Screen**: Replacing the mixed stat panel.
    - **Soldier Card:** Optimized for 56px height. - **Soldier Info**: HP bar, Number, Name, Status.
    - **Stat Visualization**: All labels (SPD, ACC, DMG, FR, ASP, Range) **MUST** be replaced with graphical icons to save space and improve scannability.
      - **Speed (SPD)**: MUST display the raw `speed` stat (e.g., "25"), NOT the derived tiles-per-second value.
    - **Tooltips**: Every stat icon must include a standard HTML `title` attribute providing the full name of the stat (e.g., `title="Attack Speed"`).
    - **Equipped Weapons**:
      - **Right Hand (Ranged)**: Weapon Icon, [Damage Icon] Value, [FR Icon] Value, [Range Icon] Value.
      - **Left Hand (Melee)**: Weapon Icon, [Damage Icon] Value, [ASP Icon] Value.
  - **Layout:** Horizontal layout. Stats must be extremely compact.
- **Command Panel (Right):** Fixed width (300px).
  - **Enemy Intel**: Displays grouped stats for visible enemies using the same **Icon + Tooltip** model as the Soldier Cards. (SPD, ACC, DMG, FR, Range).
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

**Toggle:** `~` (Tilde/Backquote) or Button in Config.

When enabled, the game displays additional diagnostic information:
- **Map:** Grid coordinates overlaid on cells.
- **LOS:** Raycast lines showing visibility calculations.
- **Fog:** Option to disable Fog of War.
- **HUD:** A "Copy World State" button appears in the Right Panel.

**World State Export:**
Clicking "Copy World State" requests a full serialization of the engine state (including seed, map definition, unit positions, and command history).
- **Format:** JSON
- **Destination:** System Clipboard (primary) and Console (fallback).
- **Usage:** This JSON can be attached to bug reports to reproduce specific states.

- **Legacy Requirements:**
  - Navmesh/path display
  - Spawn intensity heatmaps
  - Deterministic replay import/export (ReplayData)
