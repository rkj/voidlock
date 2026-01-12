import { GameState } from "@src/shared/types";

/**
 * Encapsulates the logic for tracking discovered rooms and maintaining a stable discovery order.
 */
export class RoomDiscoveryManager {
  private cellToRoomId: Map<string, string> = new Map();
  private discoveredRoomOrder: string[] = [];

  get roomOrder(): string[] {
    return this.discoveredRoomOrder;
  }

  public clear() {
    this.cellToRoomId.clear();
    this.discoveredRoomOrder = [];
  }

  public update(gameState: GameState) {
    if (this.cellToRoomId.size === 0) {
      gameState.map.cells.forEach((cell) => {
        if (cell.roomId) {
          this.cellToRoomId.set(`${cell.x},${cell.y}`, cell.roomId);
        }
      });
    }

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
