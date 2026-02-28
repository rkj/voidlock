
import { describe, it, expect, beforeEach } from 'vitest';
import { CoreEngine } from '../../../src/engine/CoreEngine';
import { 
  CommandType, 
  UnitState, 
  MapGeneratorType,
  MissionType,
  SquadConfig,
  EngineMode
} from '../../../src/shared/types';
import { MapFactory } from '../../../src/engine/map/MapFactory';

describe('AI Back and Forth Repro', () => {
  let engine: CoreEngine;

  beforeEach(() => {
    const seed = 123;
    const map = MapFactory.generate({
      width: 10,
      height: 10,
      type: MapGeneratorType.DenseShip,
      seed,
      spawnPointCount: 1,
      bonusLootCount: 0,
    });

    const squadConfig: SquadConfig = {
      soldiers: [
        { id: 'soldier_0', archetypeId: 'assault' }
      ],
      inventory: {}
    };

    engine = new CoreEngine(
      map,
      seed,
      squadConfig,
      true, // agentControlEnabled
      true, // debugOverlayEnabled
      MissionType.Default,
      false, // losOverlayEnabled
      0, // startingThreatLevel
      1.0, // initialTimeScale
      false, // startPaused
      EngineMode.Simulation
    );
  });

  it('should extract when objectives are done even if map is not fully discovered', async () => {
    // 1. Initial fast forward
    for(let i=0; i<10; i++) engine.update(100);

    let state = engine.getState();
    const unitId = state.units[0].id;

    // 2. Enable AI exploration
    engine.applyCommand({
      type: CommandType.EXPLORE,
      unitIds: [unitId]
    });

    // 3. Complete all objectives
    (engine as any).state.enemies = []; // Clear enemies to avoid distraction/death
    const objectives = state.objectives || [];
    for (const obj of objectives) {
      const objPos = obj.targetCell!;
      // Teleport unit near objective
      (engine as any).state.units[0].pos = { x: objPos.x + 0.5, y: objPos.y + 0.5 };
      (engine as any).state.units[0].targetPos = undefined;
      (engine as any).state.units[0].path = undefined;
      
      // Wait for pickup
      for(let i=0; i<60; i++) engine.update(100);
    }
    
    state = engine.getState();
    expect(state.objectives!.every(o => o.state === 'Completed')).toBe(true);

    // 4. Discover extraction
    const ext = state.map.extraction!;
    // Teleport unit near extraction to discover it
    (engine as any).state.units[0].pos = { x: ext.x + 0.5, y: ext.y + 0.5 };
    engine.update(100);
    
    // 5. Move unit AWAY from extraction so ObjectiveBehavior wants to move back to it
    (engine as any).state.units[0].pos = { x: 5.5, y: 5.5 };
    (engine as any).state.units[0].state = UnitState.Idle;
    (engine as any).state.units[0].activeCommand = undefined;
    (engine as any).state.units[0].explorationTarget = undefined;
    (engine as any).state.units[0].targetPos = undefined;
    (engine as any).state.units[0].path = undefined;
    
    state = engine.getState();

    // 6. Observe behavior over many ticks
    let extracted = false;

    for(let i=0; i<1000; i++) {
      engine.update(100);
      const s = engine.getState();
      const u = s.units[0];
      
      if (!u || u.state === UnitState.Extracted) {
        console.log('Unit extracted at tick', i);
        extracted = true;
        break;
      }

      if (i % 100 === 0) {
        const activeLabel = u.activeCommand?.label || 'None';
        const targetStr = u.targetPos ? `target=(${u.targetPos.x.toFixed(2)},${u.targetPos.y.toFixed(2)})` : 'target=None';
        console.log(`Tick ${i}: pos=(${u.pos.x.toFixed(2)},${u.pos.y.toFixed(2)}) state=${u.state} label=${activeLabel} ${targetStr}`);
      }
    }

    expect(extracted).toBe(true);
  });
});
