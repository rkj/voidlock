import * as fs from "fs";

const generator = new TreeShipGenerator(123, 16, 16);
const map = generator.generate();
console.log(MapGenerator.toAscii(map));
