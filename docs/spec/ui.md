# User Interface & Experience

## 8) UI/UX requirements (web)

### 8.1 Screen Flow Architecture

The application is divided into distinct screens to reduce UI clutter and improve flow.

### Main Menu
- **Title**: Voidlock
- **Version**: [Current Version]
- **Buttons**:
    - **Campaign**: Enter Campaign Mode.
    - **Custom Mission**: Enter Mission Setup.
    - **Statistics**: Opens the Statistics Screen (Service Record).
    - **Reset Data**: Clear all local storage and reload (Destructive, with confirmation via Custom Modal).
- **Import**: "Load Replay JSON" file picker.

1. **Mission Setup Screen** (formerly Config Screen)
   - **Shell Integration**:
     - **Campaign Mode**: MUST be rendered *within* the `CampaignShell` content area to ensure the Global Resource Header (Scrap/Intel) is visible.
     - **Custom Mode**: Can use the standalone layout.
   - **Campaign Context Header**:
     - **Location**: Below the "Mission Configuration" title.
     - **Content**:
       - **Campaign Mode**: "Campaign: [Difficulty] | Mission [N] | Sector [N]"
       - **Custom Mode**: "Custom Simulation"
     - **Style**: Subtle, informative header text (e.g., smaller font, dimmed color).
       - **Map Configuration**:
        - Generator Type (Procedural, TreeShip, Static).
        - Seed Input / Randomize.
        - Map Size (Width/Height).
        - Static Map Import (Text/File/ASCII).
        - **Visual Theme**: Dropdown to select the active UI/Map theme (e.g., "Default", "Matrix", "Retro").
           - **Game Options**:
           - Fog of War, Debug Overlay, LOS Visualization toggles.
        - **Game Speed Control**:
          - **Slider Range**: 0.1x to 10.0x (Fast Forward). Default 1.0x.
          - **Active Pause**: Speed 0.05x acts as "Active Pause", allowing commands to be issued while time moves very slowly. It is NOT part of the slider range.
          - **In-Game Access**: This control must be accessible during a mission.
          - **Controls**:
            - **Spacebar**: Toggles between "Active Pause" (0.05x) and the last used speed.
            - **UI Button**: A dedicated button (Play/Pause icon) in the UI should also toggle this state.
- **Command Set Updates:**
  - `ENGAGE/IGNORE Toggle`: Units can be toggled between 'ENGAGE' (Stop & Shoot) and 'IGNORE' (Run) policies. This toggle should be easily accessible in the command menu.
  - **Squad Configuration (Drag & Drop):**
    - **Interface**:
      - **Left Panel (Roster)**: Scrollable list of available soldiers/archetypes.
      - **Right Panel (Deployment)**: 4 fixed slots representing the squad.
    - **Interaction**:
      - **Drag & Drop**: Drag a soldier card from the Roster to a Deployment Slot to assign.
      - **Removal**: Drag a soldier out of a slot or click a "Remove" (X) button to unassign.
      - **Double-Click**: Quickly assigns/unassigns the target soldier.
    - **Constraints**:
      - Mission-Specific units (e.g., VIPs) are auto-assigned to locked slots.
      - Deployment slots reflect the maximum squad size (4).
    - **Visuals**:
      - **No Slot Labels**: Deployment slots MUST NOT display text like "Slot 1" or "Slot 2". Use `aria-label` for accessibility, but keep the visual clean.
      - **Roster Sorting**: The Roster list MUST be sorted by status to prioritize available units:
        1. **Healthy** (Top)
        2. **Wounded**
        3. **Dead** (Bottom)
      - **Deployed State**: Soldiers currently assigned to a Deployment Slot MUST be visually distinct in the Roster (e.g., dimmed opacity, blue border, or "Deployed" tag). This indicates they cannot be dragged again.
      - **Quick Actions**:
        - **Revive**: If a soldier is "Dead" and the difficulty allows cloning, a "Revive (250 Scrap)" button MUST be available directly on the soldier card in the roster.
        - **Recruit**: If the total number of available soldiers (healthy + wounded) is less than the squad size (4), a "Recruit (100 Scrap)" button MUST be available to hire a generic random rookie.
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
- **Asset Integration**:
  - Weapon names must use the user-visible `name` field from `WeaponLibrary` / `ItemLibrary` (e.g., "Pulse Rifle"), NOT the internal ID (e.g., `pulse_rifle_mk1`).

3. **Mission Screen** (Active Gameplay)
   - **Main View**: Canvas/WebGL rendering of the game world.
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
     - **Threat Meter**: Visual indicator of Director intensity (can also be in Top Bar).
   - **Bottom Panel**: Timeline/Event Log.
   - **Input**:
     - `ESC`: Opens **Pause Overlay** (Resume / Abort Mission).

### 8.2 Debug affordances (non-negotiable for balancing)

**Toggle:** `~` (Tilde/Backquote) or "Debug Overlay" checkbox in Mission Setup.

When enabled, the game displays additional diagnostic information:
- **Map Visualization**:
  - Grid coordinates overlaid on all cells.
  - **Full Visibility**: Bypasses Fog of War/Shroud visually to show the entire map and all entities.
  - **Generator Info**: Display the Generator Type and Seed used for the current map (e.g., "TreeShipGenerator (785411)").
  - **Entity Visibility**: MUST render all hidden entities, including **Items/Loot**, Enemies, and Objectives, even if they are in the fog or undiscovered.
- **LOS Diagnostics**:
  - Raycast lines showing individual visibility checks from units to visible cells.
- **HUD (Right Panel)**:
  - A **"Copy World State"** button appears.
  - Objective coordinates (`at (x,y)`) become visible in the objectives list.

**World State Export:**
Clicking "Copy World State" captures a comprehensive snapshot of the session.
- **Format:** JSON
- **Contents**:
  - `replayData`: Seed, Map Definition, Squad Config, and the full Command History.
  - `currentState`: The full `GameState` object from the engine.
  - `mapGenerator`: The name of the generator algorithm used (e.g., "TreeShipGenerator").
  - `version`: Engine/Protocol version.
  - `timestamp`: System time of export.
- **Destination:** System Clipboard (primary) and Console (fallback).
  - **Constraint:** Must check for `navigator.clipboard` availability. If unavailable (e.g., non-secure context), strictly fallback to `console.log` and alert the user.
- **Usage:** This JSON can be attached to bug reports or used with "Load Replay" to reproduce exact states.

- **Legacy Requirements:**
  - Navmesh/path display
  - Spawn intensity heatmaps
  - Deterministic replay import/export (ReplayData)

### 8.3 Control Scheme & Keyboard Navigation

The game must be fully playable via keyboard using a strict hierarchical command menu.
For detailed Command behaviors, see **[Command System & AI](commands.md)**.

#### 8.3.1 Menu State Machine

To ensure consistent navigation, the UI follows a strict state machine.

| Current State | Input / Trigger | Next State | Action / Side Effect |
| :--- | :--- | :--- | :--- |
| **Action Select** (Root) | `1` (Orders) | **Orders Select** | Show Order Submenu |
| | `2` (Engage) | **Mode Select** | Show Mode Submenu |
| | `3` (Use Item) | **Item Select** | Show Inventory List |
| | `4` (Pickup) | **Target Select** | Filter: Loot Items |
| | `5` (Extract) | **Unit Select** | Filter: All Units |
| **Orders Select** | `1` (Move) | **Target Select** | Filter: Rooms |
| | `2` (Overwatch) | **Target Select** | Filter: Intersections |
| | `3` (Explore) | **Unit Select** | Filter: All Units |
| | `4` (Escort) | **Target Select** | Filter: Friendly Units |
| | `5` (Hold) | **Unit Select** | Filter: All Units |
| | `Q` / `ESC` | **Action Select** | Clear Submenu |
| **Item Select** | `1-9` (Select Item) | **Target Select** | Filter: Contextual (See below) |
| | `Q` / `ESC` | **Action Select** | Clear Inventory |
| **Mode Select** | `1-2` (Select Mode) | **Unit Select** | Set Pending Mode |
| | `Q` / `ESC` | **Action Select** | Clear Submenu |
| **Target Select** | `1-9` / Click | **Unit Select** | Set Pending Target |
| | `Q` / `ESC` | *Previous State* | **CRITICAL:** Return to parent (Order/Item/Action) |
| **Unit Select** | `1-9` (Select Unit) | **Action Select** | **EXECUTE COMMAND** |
| | `Q` / `ESC` | *Previous State* | Return to Target/Mode selection |

**Item Targeting Context:**
- **Grenades:** `TARGET_SELECT` filter = **Visible Enemies** (If none, disable option).
- **Medkits/Stimpacks:** `TARGET_SELECT` filter = **Friendly Units**.
- **Mines:** `TARGET_SELECT` filter = **Placement Points** (Intersections/Exits).
- **Scanners:** `TARGET_SELECT` filter = **Grid Cells** (Anywhere in FOW).

#### 8.3.2 Menu Hierarchy (Visual)

- **Level 1 (Action):**
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
      - **Labeling:** Menu options must display the target name/ID directly (e.g., "soldier_1", "Room A") without redundant prefixes like "Unit" or generic labels repeated.
    - **Overwatch Intersection:** Select Intersection Point (Mapped 1-9).
    - **Escort:** Select Unit (Mapped 1-4).
    - **Item Targeting:**
      - **Grenades:** Target **Visible Enemies** ONLY. If no enemies are visible, the action is disabled.
      - **Medkits/Stimpacks:** Target **Friendly Units** (Self included).
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

- **Top Bar (Header):** Fixed height (40px).
  - **Content:**
    - **Time**: "TIME: 12.4s"
    - **Threat**: Visual Meter.
    - **Speed Control**: Play/Pause | Speed Slider (0.1x - 10x).
    - **Give Up**: Button.
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

### 8.6 Campaign Setup & Strategic UI

To ensure economic clarity, all strategic and setup screens must follow a consistent resource display.

- **Global Resource Header**:
  - **Visibility**: MUST be visible on the Sector Map, Barracks, and Equipment (Ready Room) screens.
  - **Content**:
    - **Scrap**: Displayed in `var(--color-primary)` (Green).
    - **Intel**: Displayed in `var(--color-accent)` (Blue).
  - **Style**: Floating overlay in the top-right or integrated into the top bar, consistent with the `BarracksScreen` implementation.
- **Meta Stats Display**:
  - **Location**: Visible on the Campaign Screen (e.g., in the footer or a compact header panel).
  - **Content**: Summary of key global metrics (e.g., "Total Kills").
- **Difficulty Selection (Card Selector)**:
  - Replaces the traditional dropdown menu.
  - **Visuals**: A horizontal row of 4 distinct cards.
  - **Interaction**: Single-click selection. Selected card is highlighted.
  - **Card Content**:
    - **Header**: Difficulty Name (e.g., "Ironman").
    - **Icon**: Unique icon or visual cue.
    - **Rules List**: Bullet points defining the constraints.
      - **Simulation**: "Permadeath: Off", "Save: Manual", "Pause: Allowed".
      - **Clone**: "Permadeath: Partial (Cloneable)", "Save: Manual", "Pause: Allowed".
      - **Standard**: "Permadeath: On", "Save: Manual", "Pause: Allowed".
      - **Ironman**: "Permadeath: On", "Save: Auto-Delete", "Pause: Disabled".
- **Tactical Pause Toggle**:
  - Located below the card selector.
  - **Behavior**:
    - **Default**: Checked (Enabled) for Sim, Clone, Standard.
    - **Ironman**: Unchecked and **Disabled** (Grayed out).
    - **Tooltip**: Hovering the disabled checkbox while Ironman is selected must verify: "Tactical Pause is disabled in Ironman mode."
- **Theme Selection**:
  - Dropdown or palette selector below difficulty.
- **Unit Style Selection**:
  - **Option**: Dropdown or toggle (e.g., "Visual Style").
  - **Values**:
    - **Tactical Icons (Default)**: Renders units as abstract geometric shapes (circles) with numbers, mimicking a tactical board.
    - **Sprites**: Renders units as WebP images.
      - **Overlay Requirement**: MUST strictly render the unit's tactical number (e.g., "1", "2") as a high-contrast overlay on top of the sprite to ensure readability.
- **Advanced Options (Collapsible):**
  - **Toggle**: "Show Advanced Settings" (Default: Collapsed).
  - **Content**:
    - **Seed**: Text input (allows pasting a specific seed). Randomize button.
    - **Map Generator**: Dropdown to force a specific generator (e.g., "DenseShip") for all missions, overriding the default procedural selection.
    - **Custom Difficulty**:
      - **Scaling**: Slider (50% - 200%). Affects enemy progression speed.
      - **Scarcity**: Slider (50% - 200%). Affects loot/scrap rewards.
      - **Death Rule**: Dropdown (Simulation, Clone, Iron). Decouples death consequences from the preset difficulty.
- **Actions**:
  - **Start Campaign**: Commits the configuration.
  - **Back**: Returns to Main Menu.

### 8.7 Shared UI Components

To ensure consistency between Campaign Management (Barracks) and Mission Preparation (Ready Room), the following components must be shared:

- **Soldier Inspector (Loadout UI):**
  - **Usage:** Used in both **BarracksScreen** and **EquipmentScreen**.
  - **Layout:**
    - **Left:** Soldier Stats (Attributes).
    - **Center:** Paper Doll (Visual slots for Right Hand, Left Hand, Body, Feet).
    - **Right:** Contextual Panel (Armory/Store or Recruitment).
  - **Behavior:**
    - **Persistence:** Changes made here MUST immediately write back to the `CampaignManager`.
    - **Economy:** Selecting items from the Armory triggers the "Pay-to-Equip" logic (deducting Scrap).
    - **Visuals:** Must display prices, stats, and "Owned/Equipped" indicators clearly.

- **Global Resource Header**: (See Section 8.6)

### 8.8 Visual Rendering Rules

To ensure visual clarity and correct occlusion, the renderer must adhere to a strict Layer Stacking Order (Z-Index).

1.  **Background Layer:**
    -   Floor Tiles
    -   Wall Geometry (Base)
    -   Static Map Details (Decals)
2.  **Ground Decal Layer:**
    -   Zone Indicators (Extraction Zone, Deployment Zone)
    -   Static Mission Entities (Spawn Points, Loot Crates, Terminals)
    -   **Icon Distinction**:
      -   **Objectives**: Must render with the `Objective` icon (e.g., Target/Flag).
      -   **Loot Crates**: Must render with a distinct `Crate` icon to differentiate them from mission critical objectives.
      -   **Unit Style adherence**: If the visual style is set to `TacticalIcons`, map entities (like Loot) must render as abstract, high-contrast geometric shapes using the active theme colors, ignoring sprite assets.
3.  **Unit Layer (Dynamic):**
    -   **Soldiers & Enemies:** Must render **ON TOP** of the Ground Decal Layer.
    -   *Example:* A soldier standing on a Spawn Point must obscure the Spawn Point graphic.
    -   **Projectiles/Tracers:** Rendered above units.
4.  **Fog of War (Shroud):**
    -   Obscures Layers 1-3 based on visibility.
5.  **Overlay Layer (UI):**
    -   Selection Rings/Highlights.
    -   Health Bars.
    -   Floating Text (Damage Numbers).
    -   Movement Paths (Ghosts).
    -   Objective Indicators (Icons).

### 8.9 Campaign Shell Architecture

All campaign-related screens (Sector Map, Barracks, Engineering, Stats) MUST share a common parent layout ("The Campaign Shell") to ensure UI consistency and prevent layout shifts.

- **Structure:**
  - **Top Bar (Persistent):**
    - **Left:** "Campaign Mode" Label / Current Date or Depth.
    - **Center (Navigation):** Tab-like buttons to switch between views (Sector Map, Barracks, Engineering). This replaces ad-hoc "Back" buttons.
    - **Right (Resources):** Persistent display of Scrap and Intel.
    - **Far Right:** Main Menu / Pause button.
  - **Content Area:** The active screen (Sector Map, Barracks, etc.) renders here.
- **Benefits:**
  - Solves overlap issues where local UI elements cover global resources.
  - Provides a consistent anchor for navigation.
  - Eliminates "Back button cut-off" visual bugs.

### 8.10 System Notifications (Modal System)

- **Requirement:** The game MUST NOT use native browser `alert()` or `confirm()` dialogs.
- **Implementation:** A custom `ModalService` or overlay component must be used.
- **Style:** Must match the game's theme (Dark, Cyberpunk/Tactical).
  - Usage:
  - Confirmation actions (e.g., "Reset Data", "Abort Mission").
  - Critical errors (e.g., "Save Corrupted").
  - Narrative Events (Campaign).

### 8.11 Statistics Screen (Service Record)

- **Title**: Service Record
- **Purpose**: Display cumulative lifetime statistics across all campaigns and missions.
- **Content**:
  - **Campaigns**:
    - Total Campaigns Started
    - Campaigns Won
    - Campaigns Lost
  - **Combat**:
    - Total Xeno Kills
    - Total Soldier Casualties
    - Total Missions Played
    - Total Missions Won
  - **Economy**:
    - Total Scrap Earned (Lifetime)
- **Action**: "Back to Menu" button returns the user to the Main Menu.

### 8.12 Resilience & Recovery

The application must remain navigable even in the event of a catastrophic logic crash (e.g., malformed state in LocalStorage).

- **Global Error Handling**: A top-level error listener MUST be active from the moment the page loads.
- **Panic UI Recovery**: If an unhandled exception or promise rejection occurs, the application MUST:
  1.  Force the "Main Menu" screen to be visible (`display: flex`).
  2.  Hide all other screens.
  3.  Log the error to the console for debugging.
- **Emergency Reset**: The "Reset Data" button logic MUST be initialized independently of the main application bundle (e.g., via an inline script) to ensure users can wipe corrupted state even if the main game engine fails to start.
- **Verification**: The system must be resilient to `JSON.parse` failures and missing asset manifests.

### 8.13 Geometric LOS/LOF Constraints

To ensure consistency between the visual representation and the simulation logic:

- **Door Struts**: Doors only occupy the middle 1/3 of a cell boundary. The outer 1/3 segments (struts) MUST always block LOS and LOF, regardless of the door's state.
- **Unit Precision**: LOS and LOF checks between units MUST account for the unit's physical radius. A single center-to-center ray is insufficient; the simulation should verify that a "fat" ray (or multiple sampled rays) can pass without hitting solid geometry.
- **Corner Cutting**: Shots passing extremely close to wall corners MUST be blocked if any part of the unit's radius would collide with the corner.
