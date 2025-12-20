import { GameState, MapDefinition, Unit, Enemy, Command, CommandType, UnitState, Vector2, Objective, Door, Archetype, ArchetypeLibrary, SquadConfig, CellType, MissionType } from '../shared/types';
import { GameGrid } from './GameGrid';
import { Pathfinder } from './Pathfinder';
import { Director } from './Director';
import { LineOfSight } from './LineOfSight';
import { PRNG } from '../shared/PRNG';

const EPSILON = 0.0001; // Small value for floating-point comparisons

export class CoreEngine {
  private prng: PRNG;
  private gameGrid: GameGrid;
  private doors: Map<string, Door>;
  private pathfinder: Pathfinder;
  private los: LineOfSight;
  private director: Director;
  private state: GameState;

  private agentControlEnabled: boolean; // New property
  private missionType: MissionType;
  private debugOverlayEnabled: boolean;

  constructor(map: MapDefinition, seed: number, squadConfig: SquadConfig, agentControlEnabled: boolean, debugOverlayEnabled: boolean, missionType: MissionType = MissionType.Default) {
    this.prng = new PRNG(seed);
    this.gameGrid = new GameGrid(map);
    this.doors = new Map(map.doors?.map(door => [door.id, door]));
    this.pathfinder = new Pathfinder(this.gameGrid, this.doors);
    this.los = new LineOfSight(this.gameGrid, this.doors);
    this.agentControlEnabled = agentControlEnabled; 
    this.debugOverlayEnabled = debugOverlayEnabled;
    this.missionType = missionType;

    let objectives: Objective[] = (map.objectives || []).map(o => ({
      ...o,
      state: 'Pending'
    }));

    // Mission Logic Override
    if (this.missionType === MissionType.ExtractArtifacts) {
        objectives = []; // Clear default
        const floors = map.cells.filter(c => c.type === CellType.Floor);
        // Place 3 artifacts far from spawn/extraction
        const extraction = map.extraction || { x: 0, y: 0 };
        const candidates = floors.filter(c => {
            const dx = c.x - extraction.x;
            const dy = c.y - extraction.y;
            return Math.sqrt(dx*dx + dy*dy) > map.width * 0.4; // At least 40% map width away
        });
        
        // Shuffle candidates
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = this.prng.nextInt(0, i);
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }

        const count = Math.min(3, candidates.length);
        for (let i = 0; i < count; i++) {
            objectives.push({
                id: `artifact-${i}`,
                kind: 'Recover',
                state: 'Pending',
                targetCell: { x: candidates[i].x, y: candidates[i].y }
            });
        }
    } else if (this.missionType === MissionType.DestroyHive) {
        objectives = []; // Will add after init
    }

    this.state = {
      t: 0,
      map,
      units: [],
      enemies: [],
      visibleCells: [],
      discoveredCells: [],
      objectives,
      threatLevel: 0,
      status: 'Playing',
      debugOverlayEnabled: this.debugOverlayEnabled
    };
    
    // Post-init Mission Setup (Hive)
    if (this.missionType === MissionType.DestroyHive) {
        const floors = map.cells.filter(c => c.type === CellType.Floor);
        const extraction = map.extraction || { x: 0, y: 0 };
        const candidates = floors.filter(c => {
            const dx = c.x - extraction.x;
            const dy = c.y - extraction.y;
            return Math.sqrt(dx*dx + dy*dy) > map.width * 0.5;
        });
        
        if (candidates.length > 0) {
            const hiveLoc = candidates[this.prng.nextInt(0, candidates.length - 1)];
            const hiveId = 'enemy-hive';
            
            this.addEnemy({
                id: hiveId,
                pos: { x: hiveLoc.x + 0.5, y: hiveLoc.y + 0.5 },
                hp: 500, maxHp: 500,
                type: 'Hive', 
                damage: 0, 
                fireRate: 1000,
                attackRange: 0
            });

            this.state.objectives.push({
                id: 'obj-hive',
                kind: 'Kill',
                state: 'Pending',
                targetEnemyId: hiveId
            });
        }
    }

    // Initialize Director
    const spawnPoints = map.spawnPoints || [];
    this.director = new Director(spawnPoints, this.prng, (enemy) => this.addEnemy(enemy));

    // Spawn units based on squadConfig
    let unitCount = 1;
    squadConfig.forEach(squadItem => {
        const arch = ArchetypeLibrary[squadItem.archetypeId];
        if (!arch) return;

        for (let i = 0; i < squadItem.count; i++) {
            // Use extraction point as start if available, else 0,0
            const startX = map.extraction ? map.extraction.x + 0.5 : 0.5;
            const startY = map.extraction ? map.extraction.y + 0.5 : 0.5;

            this.addUnit({
                id: `${arch.id}-${unitCount++}`,
                pos: { x: startX + (this.prng.next() - 0.5), y: startY + (this.prng.next() - 0.5) }, // Random offset
                visualJitter: { x: (this.prng.next() - 0.5) * 0.4, y: (this.prng.next() - 0.5) * 0.4 },
                hp: arch.baseHp, maxHp: arch.baseHp,
                state: UnitState.Idle,
                damage: arch.damage,
                fireRate: arch.fireRate,
                attackRange: arch.attackRange,
                sightRange: arch.sightRange,
                commandQueue: []
            });
        }
    });
  }

  public clearUnits() { 
    this.state.units = [];
  }

  public addUnit(unit: Unit) {
    this.state.units.push(unit);
  }

  public addEnemy(enemy: Enemy) { 
    this.state.enemies.push(enemy);
  }

  public getState(): GameState {
    return JSON.parse(JSON.stringify(this.state)); // Return copy to ensure isolation
  }

  public applyCommand(cmd: Command) {
    if (this.state.status !== 'Playing') return; 

    if (cmd.type === CommandType.MOVE_TO || cmd.type === CommandType.ATTACK_TARGET || cmd.type === CommandType.SET_ENGAGEMENT) {
      if (cmd.type === CommandType.ATTACK_TARGET) {
          // ATTACK_TARGET is a single-unit command in our new definition, but the loop supports arrays if we expanded it.
          // The type definition says unitId: string.
          const unit = this.state.units.find(u => u.id === cmd.unitId);
          if (unit) {
              if (cmd.queue) {
                  unit.commandQueue.push(cmd);
              } else {
                  unit.commandQueue = [];
                  this.executeCommand(unit, cmd);
              }
          }
      } else {
          // MOVE_TO or SET_ENGAGEMENT
          cmd.unitIds.forEach(id => {
            const unit = this.state.units.find(u => u.id === id);
            if (unit) {
                if (cmd.queue) {
                    unit.commandQueue.push(cmd);
                } else {
                    unit.commandQueue = []; // Clear queue on new immediate command
                    this.executeCommand(unit, cmd);
                }
            }
          });
      }
    } else if (cmd.type === CommandType.STOP) { // New: Handle STOP command
        cmd.unitIds.forEach(id => {
            const unit = this.state.units.find(u => u.id === id);
            if (unit) {
                unit.commandQueue = []; // Clear command queue
                unit.path = undefined; // Stop movement
                unit.targetPos = undefined;
                unit.forcedTargetId = undefined; // Clear forced target
                unit.explorationTarget = undefined; // Clear exploration target
                unit.state = UnitState.Idle; // Set unit to Idle state
            }
        });
    }
  }

  private executeCommand(unit: Unit, cmd: Command) {
      if (cmd.type === CommandType.MOVE_TO) {
        if (unit.state !== UnitState.Extracted && unit.state !== UnitState.Dead) {
            // Clear forced target when moving
            unit.forcedTargetId = undefined;
            // Clear exploration target if manually moved
            unit.explorationTarget = undefined; 
            
            const path = this.pathfinder.findPath(
              { x: Math.floor(unit.pos.x), y: Math.floor(unit.pos.y) },
              cmd.target
            );
            if (path && path.length > 0) {
              unit.path = path;
              unit.targetPos = { 
                  x: path[0].x + 0.5 + (unit.visualJitter?.x || 0), 
                  y: path[0].y + 0.5 + (unit.visualJitter?.y || 0) 
              }; 
              unit.state = UnitState.Moving;
            } else if (path && path.length === 0 && Math.floor(unit.pos.x) === cmd.target.x && Math.floor(unit.pos.y) === cmd.target.y) {
              // Already at target
              unit.pos = { 
                  x: cmd.target.x + 0.5 + (unit.visualJitter?.x || 0), 
                  y: cmd.target.y + 0.5 + (unit.visualJitter?.y || 0) 
              };
              unit.path = undefined;
              unit.targetPos = undefined;
              unit.state = UnitState.Idle;
            } else {
              console.warn(`No path found for unit ${unit.id} to target ${cmd.target.x},${cmd.target.y}`);
              unit.path = undefined;
              unit.targetPos = undefined;
              unit.state = UnitState.Idle;
            }
        }
      } else if (cmd.type === CommandType.ATTACK_TARGET) {
          if (unit.state !== UnitState.Extracted && unit.state !== UnitState.Dead) {
              unit.forcedTargetId = cmd.targetId;
              // Stop moving if attacking
              unit.path = undefined;
              unit.targetPos = undefined;
              // State will be updated in update() loop when combat resolves
          }
      } else if (cmd.type === CommandType.SET_ENGAGEMENT) {
          unit.engagementPolicy = cmd.mode;
      }
  }

  // Helper to calculate distance between two points (centers of cells)
  private getDistance(pos1: Vector2, pos2: Vector2): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Helper to get all cells adjacent to a door's barrier segment
  private getAdjacentCellsToDoor(door: Door): Vector2[] {
    const adjacentCells: Vector2[] = [];
    door.segment.forEach(segCell => {
      const { x, y } = segCell;
      if (door.orientation === 'Vertical') { // Door between (x,y) and (x+1,y)
        adjacentCells.push({ x: x, y: y });      // Cell to the left
        adjacentCells.push({ x: x + 1, y: y });  // Cell to the right
      } else { // Horizontal, between (x,y) and (x,y+1)
        adjacentCells.push({ x: x, y: y });      // Cell above
        adjacentCells.push({ x: x, y: y + 1 });  // Cell below
      }
    });
    // Filter duplicates and invalid cells
    const uniqueCells = new Map<string, Vector2>();
    adjacentCells.forEach(cell => {
      if (cell.x >= 0 && cell.x < this.gameGrid.width && cell.y >= 0 && cell.y < this.gameGrid.height) {
        uniqueCells.set(`${cell.x},${cell.y}`, cell);
      }
    });
    return Array.from(uniqueCells.values());
  }

  // Helper to check if any unit (soldier or enemy) is adjacent to the door
  private isUnitAdjacentToDoor(door: Door): boolean {
    const adjacentCells = this.getAdjacentCellsToDoor(door);
    for (const adjCell of adjacentCells) {
      // Check units
      if (this.state.units.some(unit => 
        unit.state !== UnitState.Dead && unit.state !== UnitState.Extracted &&
        Math.floor(unit.pos.x) === adjCell.x && Math.floor(unit.pos.y) === adjCell.y)) {
        return true;
      }
      // Check enemies
      if (this.state.enemies.some(enemy => 
        enemy.hp > 0 &&
        Math.floor(enemy.pos.x) === adjCell.x && Math.floor(enemy.pos.y) === adjCell.y)) {
        return true;
      }
    }
    return false;
  }

  // Helper to check if any soldier is adjacent to the door
  private isSoldierAdjacentToDoor(door: Door): boolean {
    const adjacentCells = this.getAdjacentCellsToDoor(door);
    for (const adjCell of adjacentCells) {
      if (this.state.units.some(unit => 
        unit.state !== UnitState.Dead && unit.state !== UnitState.Extracted &&
        Math.floor(unit.pos.x) === adjCell.x && Math.floor(unit.pos.y) === adjCell.y)) {
        return true;
      }
    }
    return false;
  }

  // Helper to find the closest undiscovered Floor cell from a given position, avoiding claimed targets
  private findClosestUndiscoveredCell(unit: Unit): Vector2 | null {
    let closestCell: Vector2 | null = null;
    let minDistance = Infinity;

    // Gather claimed targets from other units
    const claimedTargets = this.state.units
        .filter(u => u.id !== unit.id && u.explorationTarget)
        .map(u => u.explorationTarget!);

    const avoidRadius = 10; // Avoid cells within 10 tiles of other units' targets

    // Iterate over all possible cells
    for (let y = 0; y < this.state.map.height; y++) {
      for (let x = 0; x < this.state.map.width; x++) {
        const cellKey = `${x},${y}`;
        // If it's a floor cell and not yet discovered
        if (this.gameGrid.isWalkable(x, y) && !this.state.discoveredCells.includes(cellKey)) {
          const target = { x: x + 0.5, y: y + 0.5 };
          
          // Check if too close to any claimed target
          const isClaimed = claimedTargets.some(claimed => this.getDistance(target, claimed) < avoidRadius);
          
          if (!isClaimed) {
              const dist = this.getDistance(unit.pos, target);
              if (dist < minDistance) {
                minDistance = dist;
                closestCell = { x, y };
              }
          }
        }
      }
    }
    
    // Fallback: If all good targets are claimed (e.g. only 1 undiscovered area left but multiple units), ignore claims
    if (!closestCell) {
         // Repeat search without claim check
         for (let y = 0; y < this.state.map.height; y++) {
            for (let x = 0; x < this.state.map.width; x++) {
                const cellKey = `${x},${y}`;
                if (this.gameGrid.isWalkable(x, y) && !this.state.discoveredCells.includes(cellKey)) {
                    const dist = this.getDistance(unit.pos, { x: x + 0.5, y: y + 0.5 });
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestCell = { x, y };
                    }
                }
            }
         }
    }

    return closestCell;
  }

  // Helper to check if the entire map is discovered
  private isMapFullyDiscovered(): boolean {
    const totalFloorCells = this.state.map.cells.filter(c => c.type === CellType.Floor).length;
    return this.state.discoveredCells.length >= totalFloorCells;
  }
  
  // Debugging function for AI
  private logAIState(message: string) {
      console.log(`AI Debug (t=${this.state.t}): ${message}`);
  }

  public update(dt: number) {
    if (this.state.status !== 'Playing') return;

    this.state.t += dt;

    // Update Director to spawn enemies
    this.director.update(dt);
    this.state.threatLevel = this.director.getThreatLevel();

    // --- Automatic Door Logic ---
    this.doors.forEach(door => {
      // If door is destroyed, or already in a desired state, do nothing.
      if (door.state === 'Destroyed') return;

      // Handle door timers
      if (door.openTimer !== undefined && door.openTimer > 0) {
        door.openTimer -= dt;
        if (door.openTimer <= 0) {
          door.state = door.targetState!; // Apply target state
          door.openTimer = undefined;
          door.targetState = undefined;
        }
        return; // If timer is active, wait for it to complete
      }

      const unitAdjacent = this.isUnitAdjacentToDoor(door);
      const soldierAdjacent = this.isSoldierAdjacentToDoor(door);
      
      if (unitAdjacent) {
        if (door.state === 'Closed' || (door.state === 'Locked' && soldierAdjacent)) {
          // Locked doors open for soldiers
          door.targetState = 'Open';
          door.openTimer = door.openDuration * 1000;
        }
      } else { // No units adjacent
        if (door.state === 'Open') {
          door.targetState = 'Closed';
          door.openTimer = door.openDuration * 1000;
        }
      }    });

    // --- Visibility Logic ---
    const newVisibleCells = new Set<string>();
    this.state.units.forEach(unit => {
      if (unit.hp > 0 && unit.state !== UnitState.Extracted && unit.state !== UnitState.Dead) {
        const visible = this.los.computeVisibleCells(unit.pos, unit.sightRange || 10); 
        visible.forEach(cell => newVisibleCells.add(cell));
      }
    });
    this.state.visibleCells = Array.from(newVisibleCells);
    
    // Update discovered cells
    const discoveredSet = new Set(this.state.discoveredCells);
    newVisibleCells.forEach(cell => discoveredSet.add(cell));
    this.state.discoveredCells = Array.from(discoveredSet);


    const SPEED = 2; // Tiles per second

    // --- Unit Logic (Movement & Combat & Objectives) ---
    this.state.units.forEach(unit => {
      if (unit.state === UnitState.Extracted || unit.state === UnitState.Dead) return;

      // --- 1. Threat Evaluation ---
      const visibleEnemies = this.state.enemies.filter(enemy => 
        enemy.hp > 0 &&
        newVisibleCells.has(`${Math.floor(enemy.pos.x)},${Math.floor(enemy.pos.y)}`)
      );

      const threats = visibleEnemies.map(enemy => ({
        enemy,
        distance: this.getDistance(unit.pos, enemy.pos),
        priority: 1 / (this.getDistance(unit.pos, enemy.pos) + 1) // Simple proximity priority
      })).sort((a, b) => b.priority - a.priority);

      // --- 2. Self-Preservation Logic ---
      const isLowHP = unit.hp < unit.maxHp * 0.25;
      const nearbyAllies = this.state.units.filter(u => u.id !== unit.id && u.hp > 0 && u.state !== UnitState.Extracted && u.state !== UnitState.Dead && this.getDistance(unit.pos, u.pos) <= 5);
      const isIsolated = nearbyAllies.length === 0 && threats.length > 0;

      if (isLowHP && threats.length > 0) {
          // Retreat Logic: Find closest safe discovered cell
          const safeCells = this.state.discoveredCells.filter(cellKey => {
              const [cx, cy] = cellKey.split(',').map(Number);
              return !visibleEnemies.some(e => Math.floor(e.pos.x) === cx && Math.floor(e.pos.y) === cy);
          });
          
          if (safeCells.length > 0) {
              const closestSafe = safeCells.map(cellKey => {
                  const [cx, cy] = cellKey.split(',').map(Number);
                  return { x: cx, y: cy, dist: this.getDistance(unit.pos, { x: cx + 0.5, y: cy + 0.5 }) };
              }).sort((a, b) => a.dist - b.dist)[0];
              
              if (unit.state !== UnitState.Moving || !unit.targetPos || Math.floor(unit.targetPos.x) !== closestSafe.x || Math.floor(unit.targetPos.y) !== closestSafe.y) {
                  unit.engagementPolicy = 'IGNORE';
                  this.executeCommand(unit, { type: CommandType.MOVE_TO, unitIds: [unit.id], target: { x: closestSafe.x, y: closestSafe.y } });
              }
          }
      } else if (isIsolated) {
          // Group Up Logic: Move toward closest ally
          const otherUnits = this.state.units.filter(u => u.id !== unit.id && u.hp > 0 && u.state !== UnitState.Extracted && u.state !== UnitState.Dead);
          if (otherUnits.length > 0) {
              const closestAlly = otherUnits.sort((a, b) => this.getDistance(unit.pos, a.pos) - this.getDistance(unit.pos, b.pos))[0];
              if (unit.state !== UnitState.Moving || !unit.targetPos || Math.floor(unit.targetPos.x) !== Math.floor(closestAlly.pos.x) || Math.floor(unit.targetPos.y) !== Math.floor(closestAlly.pos.y)) {
                  unit.engagementPolicy = 'IGNORE'; // Temporarily ignore to reach ally
                  this.executeCommand(unit, { type: CommandType.MOVE_TO, unitIds: [unit.id], target: { x: Math.floor(closestAlly.pos.x), y: Math.floor(closestAlly.pos.y) } });
              }
          }
      } else {
          // If no longer retreating or isolated, but was in IGNORE mode, reset to ENGAGE if idle
          if (unit.engagementPolicy === 'IGNORE' && unit.state === UnitState.Idle && unit.commandQueue.length === 0) {
              unit.engagementPolicy = 'ENGAGE';
          }
      }

      // --- 3. Engagement & Autonomous Exploration ---
      // Process Queue if Idle
      if (unit.state === UnitState.Idle && unit.commandQueue.length > 0) {
          const nextCmd = unit.commandQueue.shift();
          if (nextCmd) {
              this.executeCommand(unit, nextCmd);
          }
      } else if (unit.state === UnitState.Idle && unit.commandQueue.length === 0 && this.agentControlEnabled) {
          // Priority: 1. Threat Engagement, 2. Objective, 3. Exploration, 4. Extraction
          
          let actionTaken = false;

          // 1. Threat Engagement
          if (threats.length > 0 && unit.engagementPolicy !== 'IGNORE') {
              const primaryThreat = threats[0].enemy;
              if (this.getDistance(unit.pos, primaryThreat.pos) > unit.attackRange) {
                  this.executeCommand(unit, { type: CommandType.MOVE_TO, unitIds: [unit.id], target: { x: Math.floor(primaryThreat.pos.x), y: Math.floor(primaryThreat.pos.y) } });
                  actionTaken = true;
              }
          } 
          
          // 2. Objective (if not fighting)
          if (!actionTaken && this.state.objectives) {
              // Find closest pending objective
              const pendingObjectives = this.state.objectives.filter(o => o.state === 'Pending');
              if (pendingObjectives.length > 0) {
                  // Find closest one
                  // For 'Recover', target is targetCell. For 'Kill', target is enemy pos (if known/visible).
                  // For 'Kill', if enemy is not visible, we can't path to it directly (Exploration handles it eventually).
                  
                  let bestObj: { obj: Objective, dist: number } | null = null;
                  
                  for (const obj of pendingObjectives) {
                      let targetPos: Vector2 | null = null;
                      if (obj.kind === 'Recover' && obj.targetCell) {
                          // Check if reachable (not discovered? Assume yes for now, pathfinder handles blockage)
                          // Ideally we prioritize discovered objectives.
                          targetPos = { x: obj.targetCell.x + 0.5, y: obj.targetCell.y + 0.5 };
                      } else if (obj.kind === 'Kill' && obj.targetEnemyId) {
                          const enemy = this.state.enemies.find(e => e.id === obj.targetEnemyId);
                          // Only if visible? Or cheat? Spec says "AI Support", usually implies knowledge or vision.
                          // Let's rely on vision. If not visible, ignore.
                          // Wait, "Kill" objective implies we know where it is? Or we hunt?
                          // Let's assume we hunt if visible.
                          if (enemy && newVisibleCells.has(`${Math.floor(enemy.pos.x)},${Math.floor(enemy.pos.y)}`)) {
                              targetPos = enemy.pos;
                          }
                      }

                      if (targetPos) {
                          const dist = this.getDistance(unit.pos, targetPos);
                          if (!bestObj || dist < bestObj.dist) {
                              bestObj = { obj, dist };
                          }
                      }
                  }

                  if (bestObj) {
                      // Move to objective
                      let target = { x: 0, y: 0 };
                      if (bestObj.obj.kind === 'Recover' && bestObj.obj.targetCell) target = bestObj.obj.targetCell;
                      else if (bestObj.obj.kind === 'Kill' && bestObj.obj.targetEnemyId) {
                          const e = this.state.enemies.find(en => en.id === bestObj.obj.targetEnemyId);
                          if (e) target = { x: Math.floor(e.pos.x), y: Math.floor(e.pos.y) };
                      }
                      
                      // Only if we are not already there
                      if (Math.floor(unit.pos.x) !== target.x || Math.floor(unit.pos.y) !== target.y) {
                          this.executeCommand(unit, { type: CommandType.MOVE_TO, unitIds: [unit.id], target });
                          actionTaken = true;
                      }
                  }
              }
          }

          // 3. Exploration (if no objective action)
          if (!actionTaken && !this.isMapFullyDiscovered()) {
              // Check if we already have a valid exploration target
              if (unit.explorationTarget) {
                  // Is it still undiscovered?
                  const key = `${Math.floor(unit.explorationTarget.x)},${Math.floor(unit.explorationTarget.y)}`;
                  if (this.state.discoveredCells.includes(key)) {
                      unit.explorationTarget = undefined; // Arrived or seen, pick new one
                  } else if (unit.state === UnitState.Idle) {
                      // We have a target but we are Idle? Repath.
                      this.executeCommand(unit, { type: CommandType.MOVE_TO, unitIds: [unit.id], target: unit.explorationTarget });
                  }
              }

              if (!unit.explorationTarget) {
                  const targetCell = this.findClosestUndiscoveredCell(unit);
                  if (targetCell) {
                      unit.explorationTarget = { x: targetCell.x, y: targetCell.y };
                      this.executeCommand(unit, { type: CommandType.MOVE_TO, unitIds: [unit.id], target: targetCell });
                  }
              }
          } else if (!actionTaken && this.isMapFullyDiscovered()) {
              // 4. Extraction
              // Map fully discovered, move to extraction
              unit.explorationTarget = undefined;
              if (this.state.map.extraction) {
                  const unitCurrentCell = { x: Math.floor(unit.pos.x), y: Math.floor(unit.pos.y) };
                  if (unitCurrentCell.x !== this.state.map.extraction.x || unitCurrentCell.y !== this.state.map.extraction.y) {
                      this.executeCommand(unit, { type: CommandType.MOVE_TO, unitIds: [unit.id], target: this.state.map.extraction });
                  }
              }
          }
      }

      // Objectives: Recover & Kill
      if (this.state.objectives) {
        this.state.objectives.forEach(obj => {
          if (obj.state === 'Pending') {
              if (obj.kind === 'Recover' && obj.targetCell) {
                // Check if unit is at target cell (integer coords)
                if (Math.floor(unit.pos.x) === obj.targetCell.x && Math.floor(unit.pos.y) === obj.targetCell.y) {
                  obj.state = 'Completed';
                }
              } else if (obj.kind === 'Kill' && obj.targetEnemyId) {
                  const target = this.state.enemies.find(e => e.id === obj.targetEnemyId);
                  // If not found in enemies list, it's dead (cleaned up)
                  if (!target || target.hp <= 0) {
                      obj.state = 'Completed';
                  }
              }
          }
        });
      }

      // Extraction
      if (this.state.map.extraction) {
        const ext = this.state.map.extraction;
        // Only extract if objectives are complete
        const allObjectivesComplete = this.state.objectives.every(o => o.state === 'Completed');
        
        if (allObjectivesComplete && Math.floor(unit.pos.x) === ext.x && Math.floor(unit.pos.y) === ext.y) {
          unit.state = UnitState.Extracted;
          unit.path = undefined;
          unit.targetPos = undefined;
          return; // Skip rest of logic
        }
      }

      // Combat
      let enemiesInRange = this.state.enemies.filter(enemy => 
        enemy.hp > 0 &&
        this.getDistance(unit.pos, enemy.pos) <= unit.attackRange + 0.5 &&
        newVisibleCells.has(`${Math.floor(enemy.pos.x)},${Math.floor(enemy.pos.y)}`) 
      );

      // Filter by forced target if set and valid
      if (unit.forcedTargetId) {
          const forced = enemiesInRange.find(e => e.id === unit.forcedTargetId);
          if (forced) {
              enemiesInRange = [forced];
          } else {
              const isTargetAlive = this.state.enemies.some(e => e.id === unit.forcedTargetId && e.hp > 0);
              if (!isTargetAlive) {
                  unit.forcedTargetId = undefined;
              } else {
                  enemiesInRange = [];
              }
          }
      }

      // Decision: Attack or Move?
      let isAttacking = false;
      const canAttack = enemiesInRange.length > 0;
      const isMoving = unit.path && unit.path.length > 0 || !!unit.targetPos;
      const policy = unit.engagementPolicy || 'ENGAGE';

      // Default ENGAGE: Attack takes priority over Moving (Stop & Shoot)
      // IGNORE: Moving takes priority over Attacking (Run)
      
      if (canAttack && (!isMoving || policy === 'ENGAGE')) {
        // Attack
        const targetEnemy = enemiesInRange[0];
        
        // Cooldown Check
        if (!unit.lastAttackTime || (this.state.t - unit.lastAttackTime >= unit.fireRate)) {
            targetEnemy.hp -= unit.damage;
            unit.lastAttackTime = this.state.t;
            unit.lastAttackTarget = { ...targetEnemy.pos };
        }

        unit.state = UnitState.Attacking;
        isAttacking = true;
      } 
      
      // If we didn't attack (or we are IGNORE-ing), process movement
      if (!isAttacking && isMoving && unit.targetPos && unit.path) {
        // Movement logic
        const dx = unit.targetPos.x - unit.pos.x;
        const dy = unit.targetPos.y - unit.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const moveDist = (SPEED * dt) / 1000;

        // Check if path is blocked physically (e.g. Closed Door)
        // If next step crosses cell boundary, check canMove WITHOUT allowClosedDoors.
        const currentCell = { x: Math.floor(unit.pos.x), y: Math.floor(unit.pos.y) };
        const nextCell = { x: Math.floor(unit.targetPos.x), y: Math.floor(unit.targetPos.y) };
        
        // If we are moving to a different cell, check if edge is passable
        if ((currentCell.x !== nextCell.x || currentCell.y !== nextCell.y) && 
            !this.gameGrid.canMove(currentCell.x, currentCell.y, nextCell.x, nextCell.y, this.doors, false)) {
            // Blocked! Wait.
            // Do not update unit.pos.
            // Door opening logic (earlier in update loop) should handle opening if we are adjacent.
            // We are likely adjacent if we are trying to move there.
            unit.state = UnitState.WaitingForDoor;
        } else if (dist <= moveDist + EPSILON) { 
          unit.pos = { ...unit.targetPos };
          unit.path.shift();

          if (unit.path.length === 0) {
            unit.path = undefined;
            unit.targetPos = undefined;
            unit.state = UnitState.Idle;
          } else {
            unit.targetPos = { 
                x: unit.path[0].x + 0.5 + (unit.visualJitter?.x || 0), 
                y: unit.path[0].y + 0.5 + (unit.visualJitter?.y || 0) 
            };
          }
        } else {
          unit.pos.x += (dx / dist) * moveDist;
          unit.pos.y += (dy / dist) * moveDist;
          unit.state = UnitState.Moving;
        }
      } else if (!isAttacking && !isMoving) {
        unit.state = UnitState.Idle;
      }
    });

    // --- Enemy Logic (Simple Retaliation) ---
    this.state.enemies.forEach(enemy => {
      if (enemy.hp <= 0) return;

      const unitsInRange = this.state.units.filter(unit => 
        unit.hp > 0 && unit.state !== UnitState.Extracted && unit.state !== UnitState.Dead &&
        this.getDistance(enemy.pos, unit.pos) <= enemy.attackRange + 0.5
      );

      if (unitsInRange.length > 0) {
        const targetUnit = unitsInRange[0];
        
        // Cooldown Check for Enemy
        if (!enemy.lastAttackTime || (this.state.t - enemy.lastAttackTime >= enemy.fireRate)) {
             targetUnit.hp -= enemy.damage;
             enemy.lastAttackTime = this.state.t;
             enemy.lastAttackTarget = { ...targetUnit.pos };
        }
      }
    });

    // --- Cleanup Death ---
    this.state.enemies = this.state.enemies.filter(enemy => enemy.hp > 0);
    this.state.units.forEach(unit => {
      if (unit.hp <= 0 && unit.state !== UnitState.Dead) {
        unit.state = UnitState.Dead;
      }
    });

    // --- Win/Loss Condition ---
    const activeUnits = this.state.units.filter(u => u.state !== UnitState.Dead && u.state !== UnitState.Extracted);
    const extractedUnits = this.state.units.filter(u => u.state === UnitState.Extracted);
    
    if (activeUnits.length === 0) {
      const allObjectivesComplete = this.state.objectives.every(o => o.state === 'Completed');
      if (allObjectivesComplete && extractedUnits.length > 0) {
        this.state.status = 'Won';
      } else {
        this.state.status = 'Lost'; 
      }
    }
  }
}