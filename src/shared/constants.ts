/**
 * Global simulation constants shared between Engine and Renderer.
 */

/**
 * Standard movement and fire rate normalization factor.
 * A unit with Speed 30 moves exactly 1.0 tile per second at 1.0x time scale.
 * Fire rate is also normalized by (30 / unit.speed).
 */
export const SPEED_NORMALIZATION_CONST = 30;

/**
 * Standard unit physical radius in grid cells.
 * Used for collision avoidance and line-of-fire checks.
 */
export const UNIT_RADIUS = 0.3;

/**
 * Offset to the center of a grid cell.
 */
export const CENTER_OFFSET = 0.5;
