import {
  MapDefinition,
  CellType,
  Cell,
  Door,
  SpawnPoint,
  ObjectiveDefinition,
  Vector2,
  WallDefinition,
  Direction,
} from "../../shared/types";
import { PRNG } from "../../shared/PRNG";
import { MapSanitizer } from "../map/MapSanitizer";
import { PlacementValidator, OccupantType } from "./PlacementValidator";

interface Node {
  id: number;
  gridX: number;
  gridY: number;
  centerX: number;
  centerY: number;
  roomId?: string;
}

interface Edge {
  u: number;
  v: number;
  weight: number;
}

export class SpaceshipGenerator {
  private prng: PRNG;
  private width: number;
  private height: number;
  private cells: Cell[] = [];
  private walls: Set<string> = new Set();
  private doors: Door[] = [];
  private spawnPoints: SpawnPoint[] = [];
  private squadSpawn?: Vector2;
  private squadSpawns?: Vector2[];
  private objectives: ObjectiveDefinition[] = [];
  private extraction?: Vector2;
  private placementValidator: PlacementValidator = new PlacementValidator();

  constructor(seed: number, width: number, height: number) {
    this.prng = new PRNG(seed);
    this.width = width;
    this.height = height;
  }

  private getBoundaryKey(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): string {
    const p1 = `${x1},${y1}`;
    const p2 = `${x2},${y2}`;
    return [p1, p2].sort().join("--");
  }

  public generate(
    spawnPointCount: number = 1,
    _bonusLootCount: number = 0,
  ): MapDefinition {
    this.placementValidator.clear();
    this.doors = [];
    this.spawnPoints = [];
    this.objectives = [];
    this.squadSpawns = [];
    this.squadSpawn = undefined;
    this.extraction = undefined;

    // 1. Initialize Grid (Void) and all boundaries as walls
    this.cells = Array(this.height * this.width)
      .fill(null)
      .map((_, i) => ({
        x: i % this.width,
        y: Math.floor(i / this.width),
        type: CellType.Void,
      }));

    this.walls.clear();
    for (let y = 0; y <= this.height; y++) {
      for (let x = 0; x <= this.width; x++) {
        if (x < this.width) this.walls.add(this.getBoundaryKey(x, y, x + 1, y));
        if (y < this.height)
          this.walls.add(this.getBoundaryKey(x, y, x, y + 1));
      }
    }

    // 2. Constructive Generation
    if (this.width < 12 || this.height < 12) {
      this.generateTinyMap(spawnPointCount);
    } else {
      this.generateConstructive(spawnPointCount);
    }

    // 3. Convert walls to WallDefinitions
    const mapWalls: WallDefinition[] = [];
    this.walls.forEach((key) => {
      const parts = key.split("--").map((p) => p.split(",").map(Number));
      const c1 = { x: parts[0][0], y: parts[0][1] };
      const c2 = { x: parts[1][0], y: parts[1][1] };

      if (c1.x === c2.x) {
        // Vertical adjacency -> Horizontal wall
        const maxY = Math.max(c1.y, c2.y);
        mapWalls.push({
          p1: { x: c1.x, y: maxY },
          p2: { x: c1.x + 1, y: maxY },
        });
      } else {
        // Horizontal adjacency -> Vertical wall
        const maxX = Math.max(c1.x, c2.x);
        mapWalls.push({
          p1: { x: maxX, y: c1.y },
          p2: { x: maxX, y: c1.y + 1 },
        });
      }
    });

    const map: MapDefinition = {
      width: this.width,
      height: this.height,
      cells: this.cells.filter((c) => c.type === CellType.Floor),
      walls: mapWalls,
      doors: this.doors,
      spawnPoints: this.spawnPoints,
      squadSpawn: this.squadSpawn,
      squadSpawns: this.squadSpawns,
      extraction: this.extraction,
      objectives: this.objectives,
    };

    MapSanitizer.sanitize(map);
    return map;
  }

  /**
   * Generates a spaceship-style map using a constructive spanning-tree algorithm.
   *
   * The generation process follows these high-level steps:
   * 1. Grid Partitioning: Divide the map area into a grid of nodes (potential rooms).
   * 2. Key Node Selection: Pick specific nodes for Squad Spawn, Extraction, and Objectives
   *    in different quadrants to maximize exploration.
   * 3. Spanning Tree Connectivity: Use Prim's algorithm with random weights to find a
   *    spanning tree that guarantees all key nodes (and a set density of other nodes) are connected.
   * 4. Cycle Injection: Randomly add additional edges between connected nodes to create
   *    loops and tactical alternatives, reducing "bottleneck" corridors.
   * 5. Room & Corridor Realization: Carve rooms out of nodes and connect them with 1-cell wide corridors.
   * 6. Feature Placement: Assign mission entities (Spawn Points, Loot, etc.) to the carved-out rooms.
   */
  private generateConstructive(spawnPointCount: number) {
    const nodeSize = 4;
    const cols = Math.floor(this.width / nodeSize);
    const rows = Math.floor(this.height / nodeSize);

    // 1. Initialize Nodes
    const nodes: Node[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        nodes.push({
          id: r * cols + c,
          gridX: c,
          gridY: r,
          centerX: c * nodeSize + Math.floor(nodeSize / 2),
          centerY: r * nodeSize + Math.floor(nodeSize / 2),
        });
      }
    }

    // 2. Define all possible edges with random weights
    const allEdges: Edge[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const u = r * cols + c;
        if (c < cols - 1) {
          allEdges.push({ u, v: r * cols + (c + 1), weight: this.prng.next() });
        }
        if (r < rows - 1) {
          allEdges.push({ u, v: (r + 1) * cols + c, weight: this.prng.next() });
        }
      }
    }

    // 3. Pick Key Nodes
    const squadNodes: Node[] = [];
    const maxSquadSpawns = 2;
    
    // Pick first squad node
    const squadNode1 = this.pickNodeInQuad(nodes, cols, rows, 0, 0);
    squadNodes.push(squadNode1);
    
    // Pick additional squad nodes in the SAME quadrant
    for (let i = 1; i < maxSquadSpawns; i++) {
        const node = this.pickNodeInQuad(nodes, cols, rows, 0, 0, squadNodes);
        if (node && !squadNodes.some(n => n.id === node.id)) {
            squadNodes.push(node);
        }
    }

    const extractionNode = this.pickNodeInQuad(nodes, cols, rows, 1, 1, squadNodes);
    const objectiveNode = this.pickNodeInQuad(nodes, cols, rows, 0, 1, [
      ...squadNodes,
      extractionNode,
    ]);

    const enemySpawnNodes: Node[] = [];
    const avoidForEnemy = [
      ...squadNodes,
      extractionNode,
      objectiveNode,
    ];
    for (let i = 0; i < spawnPointCount; i++) {
      const n = this.pickNodeInQuad(nodes, cols, rows, 1, 0, [
        ...avoidForEnemy,
        ...enemySpawnNodes,
      ]);
      enemySpawnNodes.push(n);
    }

    const keyNodeIds = new Set<number>([
      ...squadNodes.map(n => n.id),
      extractionNode.id,
      objectiveNode.id,
      ...enemySpawnNodes.map((n) => n.id),
    ]);

    // 4. Generate Spanning Tree connecting all Key Nodes
    const connectedNodeIds = new Set<number>([squadNodes[0].id]);
    const shipEdges: Edge[] = [];

    const getFrontier = () =>
      allEdges.filter(
        (e) =>
          (connectedNodeIds.has(e.u) && !connectedNodeIds.has(e.v)) ||
          (connectedNodeIds.has(e.v) && !connectedNodeIds.has(e.u)),
      );

    while (Array.from(keyNodeIds).some((id) => !connectedNodeIds.has(id))) {
      const frontier = getFrontier();
      if (frontier.length === 0) break;

      frontier.sort((a, b) => a.weight - b.weight);
      const bestEdge = frontier[0];

      connectedNodeIds.add(bestEdge.u);
      connectedNodeIds.add(bestEdge.v);
      shipEdges.push(bestEdge);
    }

    // 5. Add more nodes for density
    const targetDensity = 0.5 + this.prng.next() * 0.3;
    const targetNodeCount = Math.floor(nodes.length * targetDensity);
    while (connectedNodeIds.size < targetNodeCount) {
      const frontier = getFrontier();
      if (frontier.length === 0) break;
      frontier.sort((a, b) => a.weight - b.weight);
      const bestEdge = frontier[0];
      connectedNodeIds.add(bestEdge.u);
      connectedNodeIds.add(bestEdge.v);
      shipEdges.push(bestEdge);
    }

    // 6. Add some cycles
    allEdges.forEach((e) => {
      if (connectedNodeIds.has(e.u) && connectedNodeIds.has(e.v)) {
        const alreadyConnected = shipEdges.some(
          (se) =>
            (se.u === e.u && se.v === e.v) || (se.u === e.v && se.v === e.u),
        );
        if (!alreadyConnected && this.prng.next() < 0.15) {
          shipEdges.push(e);
        }
      }
    });

    // 7. Flesh out Rooms
    connectedNodeIds.forEach((nodeId) => {
      this.generateRoomForNode(nodes[nodeId], nodeSize);
    });

    // 8. Flesh out Corridors
    shipEdges.forEach((edge) => {
      this.generateCorridorBetweenNodes(nodes[edge.u], nodes[edge.v]);
    });

    // 9. Place Features
    this.placeFeaturesInNodes(
      squadNodes,
      extractionNode,
      objectiveNode,
      enemySpawnNodes,
    );
  }

  private generateRoomForNode(node: Node, nodeSize: number) {
    const w = this.prng.nextInt(3, nodeSize - 1);
    const h = this.prng.nextInt(3, nodeSize - 1);

    const rx = node.gridX * nodeSize + this.prng.nextInt(0, nodeSize - w);
    const ry = node.gridY * nodeSize + this.prng.nextInt(0, nodeSize - h);

    const finalRx = Math.max(
      node.gridX * nodeSize,
      Math.min(node.centerX, rx, (node.gridX + 1) * nodeSize - w),
    );
    const finalRy = Math.max(
      node.gridY * nodeSize,
      Math.min(node.centerY, ry, (node.gridY + 1) * nodeSize - h),
    );

    const adjustedRx =
      node.centerX >= finalRx && node.centerX < finalRx + w
        ? finalRx
        : node.centerX < finalRx
          ? node.centerX
          : node.centerX - w + 1;
    const adjustedRy =
      node.centerY >= finalRy && node.centerY < finalRy + h
        ? finalRy
        : node.centerY < finalRy
          ? node.centerY
          : node.centerY - h + 1;

    const roomId = `room-${node.gridX}-${node.gridY}`;
    node.roomId = roomId;

    for (let y = adjustedRy; y < adjustedRy + h; y++) {
      for (let x = adjustedRx; x < adjustedRx + w; x++) {
        this.setFloor(x, y);
        const cell = this.getCell(x, y);
        if (cell) cell.roomId = roomId;
        if (x < adjustedRx + w - 1) this.openWall(x, y, "e");
        if (y < adjustedRy + h - 1) this.openWall(x, y, "s");
      }
    }
  }

  private generateCorridorBetweenNodes(n1: Node, n2: Node) {
    let currX = n1.centerX;
    let currY = n1.centerY;
    const targetX = n2.centerX;
    const targetY = n2.centerY;

    const corridorId = `corridor-${n1.id}-${n2.id}`;

    while (currX !== targetX || currY !== targetY) {
      const prevX = currX;
      const prevY = currY;
      let dir: Direction;

      if (this.prng.next() < 0.5) {
        if (currX !== targetX) {
          if (currX < targetX) {
            currX++;
            dir = "e";
          } else {
            currX--;
            dir = "w";
          }
        } else {
          if (currY < targetY) {
            currY++;
            dir = "s";
          } else {
            currY--;
            dir = "n";
          }
        }
      } else {
        if (currY !== targetY) {
          if (currY < targetY) {
            currY++;
            dir = "s";
          } else {
            currY--;
            dir = "n";
          }
        } else {
          if (currX < targetX) {
            currX++;
            dir = "e";
          } else {
            currX--;
            dir = "w";
          }
        }
      }

      const c1 = this.getCell(prevX, prevY);
      const c2 = this.getCell(currX, currY);

      if (c1 && c2 && c1.roomId && c2.roomId && c1.roomId !== c2.roomId) {
        this.placeDoor(prevX, prevY, dir);
      } else {
        this.openWall(prevX, prevY, dir);
      }

      this.setFloor(currX, currY);
      const cell = this.getCell(currX, currY);
      if (cell && !cell.roomId) cell.roomId = corridorId;
    }
  }

  private pickNodeInQuad(
    nodes: Node[],
    cols: number,
    rows: number,
    qx: 0 | 1,
    qy: 0 | 1,
    avoid: Node[] = [],
  ): Node {
    const minX = qx === 0 ? 0 : Math.floor(cols / 2);
    const maxX = qx === 0 ? Math.floor(cols / 2) - 1 : cols - 1;
    const minY = qy === 0 ? 0 : Math.floor(rows / 2);
    const maxY = qy === 0 ? Math.floor(rows / 2) - 1 : rows - 1;

    const quadNodes = nodes.filter(
      (n) =>
        n.gridX >= minX &&
        n.gridX <= maxX &&
        n.gridY >= minY &&
        n.gridY <= maxY &&
        !avoid.some((a) => a.id === n.id),
    );

    if (quadNodes.length === 0) {
      const available = nodes.filter((n) => !avoid.some((a) => a.id === n.id));
      return available[this.prng.nextInt(0, available.length - 1)] || nodes[0];
    }
    return quadNodes[this.prng.nextInt(0, quadNodes.length - 1)];
  }

  private placeFeaturesInNodes(
    squadNodes: Node[],
    extractionNode: Node,
    objectiveNode: Node,
    enemySpawnNodes: Node[],
  ) {
    // 1. Squad Spawns
    this.squadSpawns = [];
    squadNodes.forEach((node, idx) => {
        const cells = this.cells.filter((c) => c.roomId === node.roomId);
        if (cells.length > 0) {
            const pos = { x: cells[0].x, y: cells[0].y };
            if (idx === 0) this.squadSpawn = pos;
            this.squadSpawns?.push(pos);
            this.placementValidator.occupy(
                cells[0],
                OccupantType.SquadSpawn,
                node.roomId
            );
        }
    });

    // 2. Extraction
    const extCells = this.cells.filter(
      (c) =>
        c.roomId === extractionNode.roomId &&
        !this.placementValidator.isCellOccupied(c),
    );
    if (extCells.length > 0) {
      const c = extCells[this.prng.nextInt(0, extCells.length - 1)];
      this.extraction = { x: c.x, y: c.y };
      this.placementValidator.occupy(
        c,
        OccupantType.Extraction,
        extractionNode.roomId,
      );
    }

    // 3. Objective
    const objCells = this.cells.filter(
      (c) =>
        c.roomId === objectiveNode.roomId &&
        !this.placementValidator.isCellOccupied(c),
    );
    if (objCells.length > 0) {
      const c = objCells[this.prng.nextInt(0, objCells.length - 1)];
      this.objectives.push({
        id: "obj-1",
        kind: "Recover",
        targetCell: { x: c.x, y: c.y },
      });
      this.placementValidator.occupy(
        c,
        OccupantType.Objective,
        objectiveNode.roomId,
      );
    }

    // 4. Enemy Spawns
    enemySpawnNodes.forEach((node, idx) => {
      const enemyCells = this.cells.filter(
        (c) =>
          c.roomId === node.roomId &&
          !this.placementValidator.isCellOccupied(c),
      );
      if (enemyCells.length > 0) {
        const c = enemyCells[this.prng.nextInt(0, enemyCells.length - 1)];
        this.spawnPoints.push({
          id: `spawn-${idx + 1}`,
          pos: { x: c.x, y: c.y },
          radius: 1,
        });
        this.placementValidator.occupy(c, OccupantType.EnemySpawn, node.roomId);
      }
    });
  }

  private generateTinyMap(spawnPointCount: number) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.setFloor(x, y);
        const cell = this.getCell(x, y);
        if (cell) cell.roomId = `room-${x}-${y}`;
        if (x < this.width - 1) this.openWall(x, y, "e");
        if (y < this.height - 1) this.openWall(x, y, "s");
      }
    }
    const floors = this.cells.filter((c) => c.type === CellType.Floor);
    if (floors.length >= 4) {
      this.squadSpawns = [];
      for (let i = 0; i < Math.min(5, floors.length - 3); i++) {
        if (i === 0) this.squadSpawn = { x: floors[i].x, y: floors[i].y };
        this.squadSpawns.push({ x: floors[i].x, y: floors[i].y });
        this.placementValidator.occupy(
          floors[i],
          OccupantType.SquadSpawn,
          floors[i].roomId,
        );
      }

      const extIdx = floors.length - 1;
      const ext = floors[extIdx];
      this.extraction = { x: ext.x, y: ext.y };
      this.placementValidator.occupy(ext, OccupantType.Extraction, ext.roomId);

      const objIdx = floors.length - 2;
      const objCell = floors[objIdx];
      this.objectives.push({
        id: "obj-1",
        kind: "Recover",
        targetCell: { x: objCell.x, y: objCell.y },
      });
      this.placementValidator.occupy(
        objCell,
        OccupantType.Objective,
        objCell.roomId,
      );

      const startEnemyIdx = this.squadSpawns.length;
      for (let i = 0; i < spawnPointCount; i++) {
        const c = floors[startEnemyIdx + i];
        if (c && !this.placementValidator.isCellOccupied(c)) {
          this.spawnPoints.push({
            id: `spawn-${i + 1}`,
            pos: { x: c.x, y: c.y },
            radius: 1,
          });
          this.placementValidator.occupy(c, OccupantType.EnemySpawn, c.roomId);
        }
      }
    }
  }

  private setFloor(x: number, y: number) {
    const cell = this.getCell(x, y);
    if (cell) cell.type = CellType.Floor;
  }

  private getCell(x: number, y: number): Cell | undefined {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return undefined;
    return this.cells[y * this.width + x];
  }

  private openWall(x: number, y: number, dir: Direction) {
    let x2 = x,
      y2 = y;
    if (dir === "n") y2--;
    else if (dir === "e") x2++;
    else if (dir === "s") y2++;
    else if (dir === "w") x2--;
    this.walls.delete(this.getBoundaryKey(x, y, x2, y2));
  }

  private placeDoor(x: number, y: number, dir: Direction) {
    const doorId = `door-${this.doors.length}`;
    let segment: Vector2[];
    let orientation: "Horizontal" | "Vertical";
    if (dir === "n") {
      orientation = "Horizontal";
      segment = [
        { x, y: y - 1 },
        { x, y },
      ];
    } else if (dir === "s") {
      orientation = "Horizontal";
      segment = [
        { x, y },
        { x, y: y + 1 },
      ];
    } else if (dir === "w") {
      orientation = "Vertical";
      segment = [
        { x: x - 1, y },
        { x, y },
      ];
    } else {
      orientation = "Vertical";
      segment = [
        { x, y },
        { x: x + 1, y },
      ];
    }
    this.openWall(x, y, dir);
    this.doors.push({
      id: doorId,
      state: "Closed",
      orientation,
      segment,
      hp: 50,
      maxHp: 50,
      openDuration: 1,
    });
  }
}
