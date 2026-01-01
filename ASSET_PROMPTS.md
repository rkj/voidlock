# Asset Generation Prompts for Xenopurge

**Target Aesthetic:** "Neon-on-Dark" Sci-Fi. Claustrophobic spaceship interiors. High contrast, industrial, retro-futuristic.
**Perspective:** Top-Down (90-degree look-down, minimal perspective distortion for grid alignment).
**Color Palette:**

- Backgrounds: Deep Black (`#000000`), Dark Grey (`#0a0a0a`), Dark Blue (`#050510`).
- Accents: Cyan (`#00FFFF`), Magenta (`#FF00FF`), Warning Red (`#FF0000`), Industrial Yellow (`#FFD700`), Electric Green (`#00FF00`).

______________________________________________________________________

## 1. Environment Tiles

**Prompt Strategy:** Generate seamless textures or top-down distinct tiles.

### Floor Tiles (Grid Cells)

- **Prompt:** "Top-down 2D sci-fi spaceship floor tile, seamless metal grating texture, dark grey industrial steel, worn and scratched, subtle cyan ambient lighting from below, high contrast, minimalistic, 64x64 pixel art style or vector style."
- **Variants:**
  - "Clean metal panels"
  - "Hazard stripe markings (yellow/black) on metal floor"
  - "Vented floor with faint steam"
  - "Blood-stained metal grating"

### Void / Outer Space (Background)

- **Prompt:** "Deep space starfield background texture, seamless, pitch black with faint distant stars, subtle dark blue nebula clouds, high contrast, non-distracting."
- **Prompt (Hull Exterior):** "Top-down view of spaceship exterior hull, dark jagged metal plates, pipes and machinery, void of space visible in gaps, dark and foreboding."

### Walls (Edge/Divider)

- **Context:** Walls are thin edges between cells.
- **Prompt:** "Top-down sci-fi wall segment, thin laser barrier or reinforced titanium bulkhead, glowing cyan energy line along the top, dark metallic base, straight horizontal orientation, 2D game asset."
- **Corner Post:** "Top-down sci-fi wall corner post, heavy reinforced metal pillar, small glowing red status light on top."

______________________________________________________________________

## 2. Units (Soldiers)

**Context:** The player controls a squad of 4 distinct soldiers.
**Style:** Top-down tokens, round or square base optional, distinct coloring for identification.

### Soldier Archetype (Generic)

- **Prompt:** "Top-down token of a futuristic space marine soldier, heavy sci-fi armor, holding a pulse rifle, distinct helmet, rim lighting to separate from dark background."
- **Color Variants (Squad Colors):**
  - **Red (Heavy/Leader):** "...red armor accents, bulky shoulder pads, holding a heavy minigun."
  - **Green (Medic/Tech):** "...green armor accents, backpack with antenna, holding a carbine."
  - **Blue (Scout):** "...blue armor accents, sleek visor, holding dual pistols or SMG."
  - **Yellow (Demolitions):** "...yellow armor accents, hazard stripes, holding a grenade launcher."

______________________________________________________________________

## 3. Enemies (Aliens)

**Context:** The "Xenopurge" targets. Insectoid/Biomechanical horrors.
**Primary Color:** Dark carapace with glowing Red/Orange/Green weak points.

### Xeno-Mite (Swarmer)

- **Prompt:** "Top-down sprite of a small alien swarmer, insectoid, scuttling legs, dark chitinous shell, glowing green eyes, sharp mandibles, fast and agile look."

### Warrior-Drone (Melee)

- **Prompt:** "Top-down sprite of a medium-sized alien warrior, xenomorph style, elongated head, sharp blade-like forelimbs, dark biomechanical texture, aggressive stance, glowing red vents on carapace."

### Praetorian-Guard (Tank)

- **Prompt:** "Top-down sprite of a large armored alien guard, bulky crab-like shell, heavy plating, slow moving, menacing, dark purple and black color scheme."

### Spitter-Acid (Ranged)

- **Prompt:** "Top-down sprite of a bloated alien spitter, swollen acid sacks on back, glowing bright green toxic liquid dripping, stationary or sluggish pose."

______________________________________________________________________

## 4. Interactive Objects

### Doors

- **Style:** Blast doors that slide open.
- **Closed (Horizontal):** "Top-down sci-fi blast door, horizontal, closed, heavy metal, yellow hazard stripes, glowing red 'locked' light in center."
- **Open (Horizontal):** "Top-down sci-fi blast door, horizontal, open, door panels retracted to sides, dark gap in middle, green 'open' light."
- **Vertical:** Same as above, rotated 90 degrees.

### Spawn Points (Enemy Entry)

- **Prompt:** "Top-down sci-fi floor vent, broken and clawed open from inside, dark hole, subtle slime residue around edges."
- **Alternative:** "Alien biomass patch on metal floor, pulsating organic matter, gross texture."

### Extraction Point

- **Prompt:** "Top-down extraction zone marker, holographic projection on floor, glowing blue circle with 'EVAC' text or arrows pointing inward, pulsating light effect."

### Objectives

- **Tech Crate:** "Top-down sci-fi supply crate, metallic, glowing keypad on top."
- **Data Terminal:** "Top-down computer terminal console, glowing blue screen, keyboard interface."

______________________________________________________________________

## 5. UI & FX

### Effects

- **Muzzle Flash:** "2D top-down muzzle flash sprite, bright yellow/white starburst, sharp pixel art or vector style."
- **Bullet Tracer:** "Glowing yellow/orange beam or projectile sprite."
- **Blood Splatter:** "Top-down alien blood splatter, bright acid green, varying sizes."
- **Explosion:** "Top-down explosion sprite, fiery orange and smoke, round expansion."

### UI Elements

- **Selection Ring:** "Glowing cyan circle outline, thin, futuristic tech style."
- **Target Reticle:** "Red crosshair or bracket, sci-fi HUD style."
- **Path/Waypoint:** "Green arrow or chevron, glowing, indicating movement path."
