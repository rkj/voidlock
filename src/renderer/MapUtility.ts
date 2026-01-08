import { MapDefinition, Door, Vector2 } from "@src/shared/types";

export class MapUtility {
  public static transformMapData(oldMapData: any): MapDefinition {
    const newCells = oldMapData.cells.map((cell: any) => {
      const { doorId, ...rest } = cell;
      return rest;
    });

    const doors: Door[] = [];
    const doorIdMap = new Map<
      string,
      { segment: Vector2[]; orientation: "Horizontal" | "Vertical" }
    >();

    oldMapData.cells.forEach((cell: any) => {
      if (cell.doorId) {
        const { x, y, doorId } = cell;
        if (!doorIdMap.has(doorId)) {
          doorIdMap.set(doorId, { segment: [], orientation: "Vertical" });
        }
        doorIdMap.get(doorId)?.segment.push({ x, y });
      }
    });

    doorIdMap.forEach((doorProps, id) => {
      const uniqueX = new Set(doorProps.segment.map((v) => v.x)).size;
      const uniqueY = new Set(doorProps.segment.map((v) => v.y)).size;

      if (uniqueX === 1 && doorProps.segment.length > 1) {
        doorProps.orientation = "Vertical";
        doorProps.segment.sort((a, b) => a.y - b.y);
      } else if (uniqueY === 1 && doorProps.segment.length > 1) {
        doorProps.orientation = "Horizontal";
        doorProps.segment.sort((a, b) => a.x - b.x);
      } else {
        doorProps.orientation = "Vertical";
      }

      doors.push({
        id,
        segment: doorProps.segment,
        orientation: doorProps.orientation,
        state: "Closed",
        hp: 100,
        maxHp: 100,
        openDuration: 1,
      });
    });

    return {
      ...oldMapData,
      cells: newCells,
      doors,
    };
  }
}
