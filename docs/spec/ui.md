# User Interface & Experience

## 8) UI/UX requirements (web)

### 8.1 Screen Flow Architecture

The application is divided into distinct screens to reduce UI clutter and improve flow.

- **Global Accessibility**: The **Settings Screen** and **Modal System** MUST be globally accessible from any game state. They must override any active screen (including shells) to ensure users can adjust preferences or respond to confirmations regardless of their current location in the application.

### Main Menu

- **Title**: Voidlock
- **Version**: [Current Version]
- **Buttons**:
  - **Campaign**: Enter Campaign Mode.
  - **Custom Mission**: Enter Mission Setup.
  - **Statistics**: Opens the Statistics Screen (Service Record).
  - **Engineering**: Opens the Engineering Bay (Meta-Progression).
  - **Settings**: Opens the Global Settings Screen.
- **Import**: "Load Replay JSON" file picker.

#### 8.1.1 Global Settings Screen

- **Purpose**: Manage persistent user preferences that apply across all game modes.
- **Visual Style Selection**:
  - **Component**: This UI element (Cards + Micro-Diorama) **MUST be a shared, reusable component**. It is used here for selection and in the "Mission Setup" screen for read-only display.
  - **Interface**: Direct selection cards.
  - **Interaction**: Click "Tactical Icons" or "Sprites". Selected card is highlighted.
  - **Visual Preview (Micro-Diorama)**: Each card contains a live canvas rendering a representative game scene.
    - **Content**: MUST display at least one of each: Friendly Soldier, Hostile Enemy, Mission Objective or Loot, and an Extraction/Exit segment.
    - **Asset Loading**: The preview must ensure all assets are loaded before rendering. If an asset is missing, a specific placeholder (not black square) must be used.
    - **Rendering**: The preview MUST reflect the currently selected Map Theme and the specific Visual Style of the card.
- **Environment Theme**: Dropdown or Palette to select the active UI/Map theme (e.g., "Default", "Matrix", "Retro").
- **Developer Options**:
  - **Log Level**: Dropdown (DEBUG, INFO, WARN, ERROR, NONE). Controls console output verbosity. Default: INFO (Dev) / ERROR (Prod).
  - **Debug Snapshots**: Toggle. If enabled, the engine records full state snapshots every N ticks for high-fidelity replay debugging.
  - **Debug Overlay**: Toggle. Enables visual debugging aids (coordinates, LOS rays, hidden entities) in-game. (Also toggleable via `~`).
- **Data Management**:
  - **Reset Data**: Clear all local storage and reload (Destructive, with confirmation via Custom Modal). Moved here to prevent accidental clicks.
- **Cloud Synchronization**:
  - **Service Status**: Indicator (e.g., "Online", "Offline", "Error").
  - **Actions**:
    - **Sign In / Connect**: (If disconnected).
    - **Sync Now**: Manually trigger a cloud save.
  - **Error Handling**:
    - If the service is unavailable (e.g., "Firebase not configured"), the "Cloud Sync" section MUST remain visible but show a clear "Service Unavailable" status.
    - **Control Enablement**: Buttons (Sync/Sign In) must be disabled if the backend service is confirmed missing, BUT the UI must explain *why* (e.g., "API Key Missing"). It must NOT look like a broken button.
- **Actions**: "Save & Back".

### Mission Setup Screen (formerly Config Screen)

- **Shell Integration**:

  - **Campaign Mode**: MUST be rendered _within_ the `CampaignShell` content area.
  - **Custom Mode**: MUST be rendered _within_ a consistent layout shell, even if not in a campaign, to ensure unified navigation.

- **Layout & Accessibility**:

  - **Scrollability**: The configuration area MUST have a vertical scrollbar if content exceeds the viewport height (especially when "Advanced Settings" are expanded). The "Initialize Expedition" or "Launch Mission" button MUST remain accessible.
  - **Unification**: The "Visual Style & Theme" section within the configuration panel MUST be a simple status display or a link to the Global Settings. Redundant dropdowns/buttons that duplicate Global Settings MUST be removed to avoid confusion.

- **Campaign Context Header**:

  - **Location**: Below the "Mission Configuration" title.
  - **Content**:
    - **Campaign Mode**: "Campaign: [Difficulty] | Mission [N] | Sector [N]"
    - **Custom Mode**: "Custom Simulation"

- **Map Configuration**:

  - Generator Type (Procedural, TreeShip, Static).
  - Seed Input / Randomize.
  - Map Size (Width/Height).
  - Static Map Import (Text/File/ASCII).

- **Global Settings Override (Optional)**:

  - Small text or icon indicating current Visual Style/Theme (read-only or quick link to Settings).

- **Game Options**:

  - Fog of War, Debug Overlay, LOS Visualization toggles.

- **Game Speed Control**:

  - **Slider Range**: 0.1x to 10.0x (Fast Forward). Default 1.0x.
  - **Active Pause**: Speed 0.05x acts as "Active Pause".
  - **Controls**: Spacebar toggles Active Pause.

- **Command Set Updates:**

  - `ENGAGE/IGNORE Toggle`: Units can be toggled between 'ENGAGE' and 'IGNORE' policies.
  - **Unified Squad Selection & Deployment:**
    - **Concept**: Selecting a soldier and placing them on the map are combined into a single workflow. A soldier on the map is "In the Squad". A soldier in the roster is "Benched".
    - **Interface**:
      - **Center View (Map Preview)**: A large canvas rendering the generated mission map.
        - **Highlight**: Squad Spawn Points are highlighted (e.g., Green Tiles).
        - **Interaction**: Valid drop targets for soldiers.
      - **Right Panel (Active Roster)**: A list of soldiers available for the mission.
        - **Sticky Actions**: "Launch Mission" button at the bottom.
    - **Interaction**:
      - **Manual (Tactical)**: Player drags a soldier from the Right Panel and drops them onto a specific **Squad Spawn Point** on the map.
      - **Quick (Auto-Fill)**: Double-clicking a soldier in the Roster automatically assigns them to the next available Spawn Point.
      - **Re-arrange**: Soldiers can be dragged from one spawn point to another.
      - **Removal**: Dragging a soldier off the map returns them to the Roster.
    - **Constraints**:
      - One soldier per spawn point.
      - Max squad size determined by available spawn points or roster limit (4).
    - **Visuals**:
      - **Deployed**: Soldiers on the map are rendered as their Tactical Icon/Sprite.
      - **Roster**: Deployed soldiers are dimmed or marked "On Map".

- **Actions**:

  - "Next: Squad & Gear" -> Proceed to Squad Management.
  - "Back" -> Main Menu.

2b. **Squad Management & Loadout**

- **Purpose**: Unified screen for selecting the squad, managing the roster, and equipping gear.
- **Access**: After "Mission Setup" or from "Campaign Hub".
- **Layout**:
  - **Left Panel (Active Squad)**: List of soldiers assigned to the current mission (Max 4).
    - **Selection**: Click to edit loadout.
    - **Remove**: Button to return soldier to Reserve Roster.
    - **Add**: "Empty Slot" buttons open the Reserve Roster picker.
  - **Center Panel (Inspector)**:
    - **Soldier Stats**: Unified component (Name, Status, Attributes).
    - **Paper Doll**: Slots for RH, LH, Body, Feet.
    - **Recruit/Revive**: If an empty slot is selected, show options to Recruit (Scrap) or Revive (Clone).
  - **Right Panel (Armory)**: Tabbed list of equipment (same as previous spec).
- **Validation**:
  - "Launch Mission" button disabled if squad is empty.
  - "Dead" soldiers in roster cannot be equipped.

### 3. Mission Screen (Active Gameplay)

- **Phase: Deployment** (Initial State)
  - **Top Bar**: "Deployment Phase".
  - **Left Panel**: Hidden or displays Mission Briefing.
  - **Center (Canvas)**: Renders the map with **Green Highlighted** Spawn Points.
  - **Right Panel (Deployment Control)**:
    - **Squad List**: Interactive list of all assigned soldiers.
      - **Status**: Indicates "Deployed (on map)" or "Pending".
      - **Interaction**: Draggable items.
    - **Start Mission**: Button (Enabled only when all units are validly placed).
  - **Interaction**:
    - **Drag & Drop**: Drag soldier from **Right Panel** to a **Green Spawn Point** on map.
    - **Re-position**: Drag soldier from one map tile to another.
    - **Auto-Fill**: Button/Double-click to assign random valid spots.
- **Phase: Active** (After Start)
  - **Main View**: Canvas/WebGL rendering of the game world.
  - **Left Panel**: Squad List (Health, Status) + Quick Commands.
  - **Right Panel**: Objectives, Extraction, Threat, Intel.
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

#### 8.3.0 Unit Selection Model

- There is **no** persistent "currently selected soldier" on the map.
- Commands that apply to units always require explicit **Unit Select** confirmation.
- `EXTRACT` skips target selection and executes immediately after Unit Select confirmation.

#### 8.3.1 Menu State Machine

To ensure consistent navigation, the UI follows a strict state machine.

| Current State | Input / Trigger | Next State | Action / Side Effect |
| :----------------------- | :------------------ | :---------------- | :------------------------------------------------- |
| **Action Select** (Root) | `1` (Orders) | **Orders Select** | Show Order Submenu |
| | `2` (Engage) | **Mode Select** | Show Mode Submenu |
| | `3` (Use Item) | **Item Select** | Show Inventory List |
| | `4` (Pickup) | **Target Select** | Filter: Loot Items |
| | `5` (Extract) | **Unit Select** | No target selection. Execute extract order immediately after unit confirmation |
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
| | `Q` / `ESC` | _Previous State_ | **CRITICAL:** Return to parent (Order/Item/Action) |
| **Unit Select** | `1-9` (Select Unit) | **Action Select** | **EXECUTE COMMAND** |
| | `Q` / `ESC` | _Previous State_ | Return to Target/Mode selection |

**Item Targeting Context:**

- **Grenades:** `TARGET_SELECT` filter = **Visible Enemies** (If none, disable option).
- **Medkits/Stimpacks:** `TARGET_SELECT` filter = **Friendly Units**.
- **Mines:** `TARGET_SELECT` filter = **Placement Points** (Intersections/Exits).
- **Scanners:** `TARGET_SELECT` filter = **Friendly Units**.

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
      - **Pickup:** This action allows selecting **Single Units ONLY**. The "All Units" option must be disabled or hidden.
  - **Universal Back:** `Q` or `ESC` always goes back one level.
- **Menu UX Requirements:**
  - **Context Header:** The Menu must display a explicit **Context Header** (Breadcrumbs or Parent Title) to indicate the current active submenu (e.g., "Pickup > Select Target", "Orders > Move").
  - **Item Display:** Lists of items (Pickup, Inventory) MUST use the user-friendly `name` field (e.g., "Pulse Rifle", "Artifact Alpha") and NEVER internal IDs (e.g., "collect_recover", "scrap_crate").
  - **Unit Display:** Lists of units MUST display the format `Name (Tactical Number)` (e.g., "Sgt. Apone (1)", "Pvt. Hudson (2)") to allow correlation with the map view.
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
    - **Time**: "Time: 12.4s"
    - **Threat**: Visual Meter.
    - **Speed Control**: Play/Pause | Speed Slider (0.1x - 10x).
    - **Give Up**: Button.
  - **Soldier Bar (Sub-header):** Full-width strip below the top bar (Height: 56px). Displays all soldiers in a horizontal layout.
    - **Reusable Stat Component**: The icon-based stat display used here MUST be extracted and reused in:
      - **Squad Selection Screen**: Replacing the text-based stats.
      - **Equipment Screen**: Replacing the mixed stat panel.
        - **Soldier Card:** Optimized for 56px height.
          - **Soldier Info**: HP bar, Name, Status.
          - **Tactical Number**: Displayed ONLY during active missions to correlate with the map. This number is mission-specific based on deployment order and MUST NOT appear in the Barracks, Equipment Screen, or Debrief Screen.
        - **Stat Visualization**:
          All labels (SPD, ACC, DMG, FR, ASP, Range) **MUST** be replaced with graphical icons to save space and improve scannability.
      - **Speed (SPD)**: MUST display the raw `speed` stat (e.g., "25"), NOT the derived tiles-per-second value.
    - **Tooltips**: Every stat icon must include a standard HTML `title` attribute providing the full name of the stat (e.g., `title="Attack Speed"`).
    - **Equipped Weapons**:
      - **Right Hand (Ranged)**: Weapon Icon, [Damage Icon] Value, [FR Icon] Value, [Range Icon] Value.
      - **Left Hand (Melee)**: Weapon Icon, [Damage Icon] Value, [ASP Icon] Value.
  - **Layout:** Horizontal layout. Stats must be extremely compact.
- **Command Panel (Right):** Fixed width (300px).
  - **Enemy Intel**: Displays grouped stats for visible enemies using the same **Icon + Tooltip** model as the Soldier Cards. (SPD, ACC, DMG, FR, Range).
- **Main Simulation Area:** Flex container containing the Game Canvas. Centered. Overlay navigation numbers appear on the canvas during target/unit selection.

### 8.4.1 Debrief Screen (Post-Mission)

- **Layout**: Split-pane layout (approx. 40/60 split).
- **Left Pane (Information)**:
  - **Mission Statistics**: Tally of kills, time, and scrap.
  - **Squad Summary**: List of participating units with Names and XP bars.
  - **Actions**:
    - **Continue**: Return to Command Bridge.
    - **Replay Mission** (Custom Mode ONLY): Immediately restarts the mission with the exact same Seed and Configuration.
    - **Export Recording**: Downloads the full mission replay data as a JSON file for debugging or sharing.
- **Right Pane (Replay Viewport)**:
  - **Visuals**: Dedicated canvas rendering the mission replay.
  - **Playback Controls**: A control bar positioned at the bottom of the viewport containing:
    - **Play/Pause Button**.
    - **Speed Selector**: [1x, 2x, 5x, 10x].
- **Visibility**: Automatically shown after mission completion.

### 8.4.2 Asset Visual Scale

- **Rule**: Game world sprites (Soldiers, Enemies, Objects) must be scaled to approximately **30%** of their raw asset size (approx. 38-40px on a 128px grid) to maintain tactical clarity and avoid overlapping with walls.
- **Consistency**: UI icons and tactical overlays must follow a consistent visual scale to ensure information density.

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
  - **Interface**: Direct selection cards (See Section 8.1).
  - **Values**:
    - **Tactical Icons (Default)**: Abstract geometric shapes.
    - **Sprites**: WebP images with high-contrast tactical number overlays.
- **Advanced Options (Collapsible):**
  - **Toggle**: "Show Advanced Settings" (Default: Collapsed).
  - **Content**:
    - **Seed**: Text input (allows pasting a specific seed). Randomize button.
    - **Map Generator**: Dropdown to force a specific generator (e.g., "DenseShip") for all missions, overriding the default procedural selection.
    - **Custom Difficulty**:
      - **Scaling**: Slider (50% - 200%). Affects enemy progression speed.
      - **Scarcity**: Slider (50% - 200%). Affects loot/scrap rewards.
      - **Death Rule**: Dropdown (Simulation, Clone, Iron). Decouples death consequences from the preset difficulty.
- **Settings Persistence**:
  - **Global Settings**: Visual Style (Section 8.1) and Environment Theme MUST be stored as global user preferences. They MUST NOT be tied to individual campaign saves and should persist across campaign resets.
  - **Campaign Rules**: Difficulty, Death Rules, and Pause Constraints remain tied to the specific campaign save.
- **Actions**:
  - **Start Campaign**: Commits the configuration. **CRITICAL**: Starting a new campaign MUST clear any cached deployment squad configurations from previous sessions to prevent "Soldier Not Found" errors.
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

1. **Background Layer:**
   - Floor Tiles
   - Wall Geometry (Base)
   - Static Map Details (Decals)
1. **Ground Decal Layer**:
   - **Zone Indicators**:
     - **Extraction Zone**:
       - **Visibility**: MUST respect Fog of War. Visible only if the cell is **Discovered** or **Visible**, or if Debug Overlay is enabled.
       - **Standard Mode**: MUST render using an appropriate Sprite (e.g., `waypoint` or specific pad graphic).
       - **Tactical Mode**: Render as a high-contrast geometric overlay (e.g., Green Grid).
   - **Static Mission Entities**:
     - **Enemy Spawn Points**:
       - **Requirement**: MUST respect Fog of War. Visible only if the cell is **Discovered** or **Visible**, or if Debug Overlay is enabled.
       - **Standard Mode**: Render using the `spawn_point` WebP sprite.
       - **Tactical Mode**: Render as a distinct abstract icon (e.g., Vent/Crosshair).
     - **Objectives**:
       - **Standard Mode**: Render as a Sprite (e.g., Data Disk).
       - **Tactical Mode**: Render as the `Objective` icon (Target/Flag).
     - **Loot Crates**:
       - **Standard Mode**: Render as a `Crate` Sprite.
       - **Tactical Mode**: Render as a distinct Tactical Icon (e.g., Star/Diamond) or `loot_star.svg`, ignoring the sprite asset.
   - **Unit Style adherence**: If the visual style is set to `TacticalIcons`, ALL map entities must strictly follow the Tactical Mode rules above, using abstract, high-contrast geometric shapes or vector icons.
1. **Unit Layer (Dynamic):**
   - **Soldiers & Enemies:** Must render **ON TOP** of the Ground Decal Layer.
   - _Example:_ A soldier standing on a Spawn Point must obscure the Spawn Point graphic.
   - **Projectiles/Tracers:** Rendered above units.
1. **Fog of War (Shroud):**
   - Obscures Layers 1-3 based on visibility.
1. **Overlay Layer (UI):**
   - Selection Rings/Highlights.
   - Health Bars.
   - Floating Text (Damage Numbers).
   - Movement Paths (Ghosts).
   - Objective Indicators (Icons).

### 8.9 Campaign Shell Architecture

All campaign-related screens (Sector Map, Barracks, Engineering, Stats) MUST share a common parent layout ("The Campaign Shell") to ensure UI consistency and prevent layout shifts.

- **Structure:**
  - **Top Bar (Persistent):**
    - **Left:** Mode Label (e.g. "Campaign Mode", "Service Record").
    - **Center (Navigation):** Tab-like buttons to switch between views.
      - **Campaign Mode**: [Sector Map], [Barracks], [Service Record], [Settings].
      - **Statistics Mode**: [Service Record].
    - **Right (Resources):** Persistent display of Scrap and Intel (Campaign only).
    - **Far Right:** Main Menu.
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
  1. Force the "Main Menu" screen to be visible (`display: flex`).
  1. Hide all other screens.
  1. Log the error to the console for debugging.
- **Emergency Reset**: The "Reset Data" button logic MUST be initialized independently of the main application bundle (e.g., via an inline script) to ensure users can wipe corrupted state even if the main game engine fails to start.
- **Verification**: The system must be resilient to `JSON.parse` failures and missing asset manifests.

### 8.13 Geometric LOS/LOF Constraints

To ensure consistency between the visual representation and the simulation logic:

- **Door Struts**: Doors only occupy the middle 1/3 of a cell boundary. The outer 1/3 segments (struts) MUST always block LOS and LOF, regardless of the door's state.

- **Unit Precision**: LOS and LOF checks between units MUST account for the unit's physical radius. A single center-to-center ray is insufficient; the simulation should verify that a "fat" ray (or multiple sampled rays) can pass without hitting solid geometry.

- **Corner Cutting**: Shots passing extremely close to wall corners MUST be blocked if any part of the unit's radius would collide with the corner.

## 9. Accessibility & Input (Epic)

The game must be fully playable without a mouse, catering to power users and accessibility needs.

- **Keyboard First**: Every UI element (buttons, lists, map tiles) must be navigable and actionable via keyboard.

  - **Focus Management**: A robust system to track and visually indicate the active element.

    - **Post-Action Focus**: When an interactive element is removed or replaced (e.g., purchasing an item, recruiting a soldier), focus MUST remain stable. It should move to the newly created element or the nearest logical sibling. It MUST NOT reset to the top of the page or the "Back" button.

    - **Tab Traps**: Modal dialogs and complex panels (like the Armory) must "trap" focus, preventing Tabbing from escaping to the browser chrome or underlying layers.

    - **Skip Inaccessible**: Navigation (Tab or Arrow Keys) MUST skip inactive, disabled, or strictly visual elements (like the "Remove X" on a mandatory weapon slot).

  - **Shortcuts**: Standardized keys for common actions (e.g., `Space` to Pause, `Tab` to Cycle Units).

- **Shortcut Reference**:

  - **Toggle**: `?` (Shift + /).

  - **Overlay**: A modal displaying all current context-relevant keyboard shortcuts.

## 10. Mobile Responsiveness (Epic)

The interface must adapt to small touch screens without losing functionality.

- **Layout Adaptation**:

  - **Compact Mode**: On screens < 768px, sidebars (Soldier List, Objectives) should collapse into drawers or toggleable overlays.

  - **Hit Targets**: All interactive elements must differ to a minimum touch target size (44x44px).

- **Touch Controls**:

  - **Camera**: Pinch-to-zoom and two-finger pan.

  - **Interaction**: Tap to Select, Drag to Deploy. Long-press for Context Menu (right-click equivalent).

- **Scale**: UI scaling factor adjustment for high-DPI (Retina) mobile displays to ensure readability.

## 11. Visual Polish & Typography

### 11.1 Casing Standards

- **Strict Title Case**: All UI buttons, headers, menu actions, and labels MUST use **Title Case** (e.g., "Deploy Squad", "Enter Shop").

- **No All-Caps**: The use of ALL CAPS is strictly forbidden, except for specific, established acronyms (e.g., "HUD", "XP", "HP"). If a "shouting" effect is desired for narrative events, it must be achieved via font weight or color, not casing.

### 11.2 Scrollbar Discipline

- **No Global Scroll**: The main application window (`<body>`) MUST NEVER display a scrollbar. The game viewport must be fixed.

- **Panel Scrolling**: Content that exceeds the available space (e.g., long lists in the Barracks or Shop) MUST scroll internally within its container.

- **Scroll Visibility**: Scrollbars should be styled unobtrusively but remain visible to indicate overflow.
