
import { MapFactory } from './src/engine/map/MapFactory';
import { MapGeneratorType } from './src/shared/types';

const seed = 123;
const map = MapFactory.generate({
  width: 10,
  height: 10,
  type: MapGeneratorType.DenseShip,
  seed,
  spawnPointCount: 1,
  bonusLootCount: 0,
});

console.log('Map 10x10, seed 123, DenseShip');
const cell = map.cells.find(c => c.x === 5 && c.y === 5);
console.log('Cell (5,5):', cell ? cell.type : 'Missing');

if (cell) {
    console.log('Edges:', cell.edges);
}

console.log('Squad Spawns:', map.squadSpawns);
console.log('Squad Spawn:', map.squadSpawn);
console.log('Spawn Points:', map.spawnPoints);
