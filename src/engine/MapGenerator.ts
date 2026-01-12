import { MapFactory } from "./map/MapFactory";
export * from "./map";

/**
 * @deprecated Use MapFactory from ./map/MapFactory instead.
 * Maintaining this for backward compatibility during refactoring.
 */
export const MapGenerator = MapFactory;
export type MapGenerator = MapFactory;
