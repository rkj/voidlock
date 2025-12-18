import { TreeShipGenerator } from './src/engine/generators/TreeShipGenerator';
import { MapGenerator } from './src/engine/MapGenerator';

const generator = new TreeShipGenerator(123, 40, 40);
const map = generator.generate();
console.log(MapGenerator.toAscii(map));
