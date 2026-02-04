# ADR 0026: Geometric LOS and LOF Precision

**Status:** Proposed

## Context

The current implementation of Line of Sight (LOS) and Line of Fire (LOF) in `LineOfSight.ts` uses a center-to-center raycast on a cell-by-cell basis (Amanatides-Woo algorithm). While this is efficient for grid traversal, it lacks the precision required for high-fidelity tactical combat as defined in `spec/ui.md#8.13`:

1. **Door Struts**: Doors only occupy the middle 1/3 of a cell boundary. The outer 1/3 segments (struts) MUST always block LOS/LOF, even when the door is open. The renderer (`MapLayer.ts`) already visualizes these struts, but the simulation ignores them.
1. **Unit Radius**: Units have a physical radius (approx. 0.3 cells). A single center-ray LOS check allows units to see through gaps smaller than themselves or shoot "impossible" shots that clip through wall corners.
1. **Corner Cutting**: Shots passing infinitesimally close to a convex wall corner should be blocked if they collide with the unit's physical bounds.

## Decision

We will transition to a geometric ray-segment intersection model that accounts for sub-cell features and unit dimensions.

### 1. Fractional Boundary Intersection

The `raycast` algorithm will be updated to calculate the exact intersection point (fractional coordinate) on each boundary it crosses.

- **Strut Detection**: When a ray hits a boundary containing a door, we calculate the intersection parameter $t \\in [0, 1]$ along that boundary.
  - If $t < 1/3$ or $t > 2/3$, the ray has hit a **Strut**. Struts are treated as `Wall` boundaries (always block LOS/LOF).
  - If $1/3 \\le t \\le 2/3$, the ray has hit the **Door Leaf**. It blocks LOS/LOF based on the door's state (Closed/Locked blocks; Open/Destroyed passes).

### 2. Multi-Ray LOF (Line of Fire)

To account for unit radius during combat, `hasLineOfFire` will use a **Multi-Ray Sampling** strategy:

- **Primary Ray**: Center-to-center.
- **Secondary Rays**: Two rays offset by `UNIT_RADIUS` perpendicular to the shot direction.
- **Condition**: LOF is only granted if **ALL** sampled rays are clear. This prevents units from shooting through narrow gaps (like a partially open door) that would physically block their weapon or body.

### 3. Peek-Aware LOS (Line of Sight)

For visibility/fog-of-war, we want to allow units to "peek" around corners.

- **Condition**: `hasLineOfSight` is granted if **ANY** of the sampled rays (Center or Offsets) is clear. This ensures that if a soldier can see even a sliver of a cell, it is revealed.

### 4. Corner Buffering

To prevent corner cutting, the intersection check will include a small epsilon or radius-based check at vertices. If a ray passes within `UNIT_RADIUS` of a solid convex corner, it is blocked.

## Consequences

- **Performance**: LOS/LOF checks become $3\\times$ to $5\\times$ more expensive due to multi-ray sampling. However, since the unit count is low (4 soldiers + $\\approx 10-20$ enemies), this is acceptable for a Web Worker simulation.
- **Determinism**: The geometric calculations must use consistent precision to maintain determinism across different browsers.
- **Visual Feedback**: The `Renderer` (and specifically the `OverlayLayer`) must be updated to visualize these "fat" rays when LOS diagnostics are enabled, helping players understand why a shot is blocked.
- **Complexity**: `LineOfSight.ts` will require a significant refactor to move beyond simple grid traversal into exact intersection math.
