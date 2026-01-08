# User Interface & Experience

## 8) UI/UX requirements (web)

### 8.1 Screen Flow Architecture

The application is divided into distinct screens to reduce UI clutter and improve flow.

1. **Main Menu (Welcome Screen)**
   - **Title**: "Voidlock"
   - **Version**: displayed here (e.g., v0.62.0).
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

### 8.3 Control Scheme & Keyboard Navigation

The game must be fully playable via keyboard using a strict hierarchical command menu.
For detailed Command behaviors, see **[Command System & AI](commands.md)**.

#### 8.3.1 Menu State Machine

To ensure consistent navigation, the UI follows a strict state machine.

| Current State | Input / Trigger | Next State | Action / Side Effect |
| :--- | :--- | :--- | :--- |
| **ACTION_SELECT** (Root) | `1` (Orders) | **ORDERS_SELECT** | Show Order Submenu |
| | `2` (Engage) | **MODE_SELECT** | Show Mode Submenu |
| | `3` (Use Item) | **ITEM_SELECT** | Show Inventory List |
| | `4` (Pickup) | **TARGET_SELECT** | Filter: Loot Items |
| | `5` (Extract) | **UNIT_SELECT** | Filter: All Units |
| **ORDERS_SELECT** | `1` (Move) | **TARGET_SELECT** | Filter: Rooms |
| | `2` (Overwatch) | **TARGET_SELECT** | Filter: Intersections |
| | `3` (Explore) | **UNIT_SELECT** | Filter: All Units |
| | `4` (Escort) | **TARGET_SELECT** | Filter: Friendly Units |
| | `5` (Hold) | **UNIT_SELECT** | Filter: All Units |
| | `Q` / `ESC` | **ACTION_SELECT** | Clear Submenu |
| **ITEM_SELECT** | `1-9` (Select Item) | **TARGET_SELECT** | Filter: Contextual (See below) |
| | `Q` / `ESC` | **ACTION_SELECT** | Clear Inventory |
| **MODE_SELECT** | `1-2` (Select Mode) | **UNIT_SELECT** | Set Pending Mode |
| | `Q` / `ESC` | **ACTION_SELECT** | Clear Submenu |
| **TARGET_SELECT** | `1-9` / Click | **UNIT_SELECT** | Set Pending Target |
| | `Q` / `ESC` | *Previous State* | **CRITICAL:** Return to parent (Order/Item/Action) |
| **UNIT_SELECT** | `1-9` (Select Unit) | **ACTION_SELECT** | **EXECUTE COMMAND** |
| | `Q` / `ESC` | *Previous State* | Return to Target/Mode selection |

**Item Targeting Context:**
- **Grenades:** `TARGET_SELECT` filter = **Visible Enemies** (If none, disable option).
- **Medkits/Stimpacks:** `TARGET_SELECT` filter = **Friendly Units**.
- **Mines/Scanners:** `TARGET_SELECT` filter = **Grid Cells** (Range limited).

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

### 8.2 Debug affordances (non-negotiable for balancing)

**Toggle:** `~` (Tilde/Backquote) or "Debug Overlay" checkbox in Mission Setup.

When enabled, the game displays additional diagnostic information:
- **Map Visualization**:
  - Grid coordinates overlaid on all cells.
  - **Full Visibility**: Bypasses Fog of War/Shroud visually to show the entire map and all entities.
  - **Generator Info**: Display the Generator Type and Seed used for the current map (e.g., "TreeShipGenerator (785411)").
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

- **Global Resource Header:** (See Section 8.6)

### 8.6 Campaign Setup & Strategic UI

To ensure economic clarity, all strategic and setup screens must follow a consistent resource display.

- **Global Resource Header**:
  - **Visibility**: MUST be visible on the Sector Map, Barracks, and Equipment (Ready Room) screens.
  - **Content**:
    - **SCRAP**: Displayed in `var(--color-primary)` (Green).
    - **INTEL**: Displayed in `var(--color-accent)` (Blue).
  - **Style**: Floating overlay in the top-right or integrated into the top bar, consistent with the `BarracksScreen` implementation.
- **Difficulty Selection (Card Selector)**:
  - Replaces the traditional dropdown menu.
  - **Visuals**: A horizontal row of 4 distinct cards.
  - **Interaction**: Single-click selection. Selected card is highlighted.
  - **Card Content**:
    - **Header**: Difficulty Name (e.g., "IRONMAN").
    - **Icon**: Unique icon or visual cue.
    - **Rules List**: Bullet points defining the constraints.
      - **Simulation**: "Permadeath: OFF", "Save: Manual", "Pause: ALLOWED".
      - **Clone**: "Permadeath: PARTIAL (Cloneable)", "Save: Manual", "Pause: ALLOWED".
      - **Standard**: "Permadeath: ON", "Save: Manual", "Pause: ALLOWED".
      - **Ironman**: "Permadeath: ON", "Save: Auto-Delete", "Pause: DISABLED".
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
    - **Sprites (Default)**: Renders units as WebP images.
      - **Overlay Requirement**: MUST strictly render the unit's tactical number (e.g., "1", "2") as a high-contrast overlay on top of the sprite to ensure readability.
    - **Tactical Icons**: Renders units as abstract geometric shapes (circles) with numbers, mimicking a tactical board.
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