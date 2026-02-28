import { CoreEngine } from './src/engine/CoreEngine';
import { CommandType, UnitState, MapGeneratorType, MissionType, EngineMode } from './src/shared/types';
import { MapFactory } from './src/engine/map/MapFactory';

const seed = 123;
const map = MapFactory.generate({ width: 10, height: 10, type: MapGeneratorType.DenseShip, seed, spawnPointCount: 1, bonusLootCount: 0 });
console.log("Map bounds:", map.width, map.height);
console.log("Extraction:", map.extraction);
console.log("Spawn:", map.spawnPoints[0]);
console.log("Cell at 5,5:", map.cells.find(c => c.x === 5 && c.y === 5));
