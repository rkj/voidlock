import { GameState, Vector2 } from "@src/shared/types";
import { MathUtils } from "@src/shared/utils/MathUtils";

/**
 * Encapsulates the logic for tracking discovered rooms and maintaining a stable discovery order.
 */
export class RoomDiscoveryManager {
  private cellToRoomId: Map<string, string> = new Map();
  private discoveredRoomOrder: string[] = [];
  private roomCenters: Map<string, Vector2> = new Map();

  get roomOrder(): string[] {
    return this.discoveredRoomOrder;
  }

  public getRoomCenter(roomId: string): Vector2 | undefined {
    return this.roomCenters.get(roomId);
  }

  public clear() {
    this.cellToRoomId.clear();
    this.discoveredRoomOrder = [];
    this.roomCenters.clear();
  }

  public update(gameState: GameState) {
    if (this.cellToRoomId.size === 0 && gameState.map.cells && gameState.map.cells.length > 0) {
      const roomCells = new Map<string, { x: number; y: number }[]>();

      gameState.map.cells.forEach((cell) => {
        if (cell.roomId) {
          this.cellToRoomId.set(`${cell.x},${cell.y}`, cell.roomId);
          
          if (!roomCells.has(cell.roomId)) {
            roomCells.set(cell.roomId, []);
          }
          roomCells.get(cell.roomId)!.push({ x: cell.x, y: cell.y });
        }
      });

      // Pre-calculate room centers
      roomCells.forEach((cells, roomId) => {
        if (cells.length === 0) return;

        const avgX = cells.reduce((sum, c) => sum + c.x, 0) / cells.length;
        const avgY = cells.reduce((sum, c) => sum + c.y, 0) / cells.length;
        const avgPos = { x: avgX, y: avgY };

        // Find cell closest to average center
        const centerCell = cells.reduce((prev, curr) => {
          const prevDist = MathUtils.getDistanceSquared(prev, avgPos);
          const currDist = MathUtils.getDistanceSquared(curr, avgPos);
          return currDist < prevDist ? prev : curr;
        });

        this.roomCenters.set(roomId, { x: centerCell.x, y: centerCell.y });
      });
    }

    if (gameState.discoveredCells) {
      gameState.discoveredCells.forEach((cellKey) => {
        const roomId = this.cellToRoomId.get(cellKey);
        if (
          roomId &&
          roomId.startsWith("room") &&
          !this.discoveredRoomOrder.includes(roomId)
        ) {
          this.discoveredRoomOrder.push(roomId);
        }
      });
    }
  }
}
