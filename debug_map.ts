
import { MapFactory } from "./src/engine/map/MapFactory";
import { MapGeneratorType } from "./src/shared/types";
import { PRNG } from "./src/shared/PRNG";

const config = {
    seed: 12345,
    width: 6,
    height: 6,
    type: MapGeneratorType.DenseShip,
    spawnPointCount: 4
};

const map = MapFactory.generate(config);
console.log("Spawn Points:", map.squadSpawns);
