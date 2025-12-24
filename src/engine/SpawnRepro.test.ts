import { describe, it, expect } from 'vitest';
import { TreeShipGenerator } from './generators/TreeShipGenerator';
import { SpaceshipGenerator } from './generators/SpaceshipGenerator';
import { DenseShipGenerator } from './generators/DenseShipGenerator';

describe('Spawn Point Count Verification', () => {
    const seed = 12345;
    const width = 16;
    const height = 16;

    it('TreeShipGenerator should have 1 spawn point when requested', () => {
        const gen = new TreeShipGenerator(seed, width, height);
        const map = gen.generate(1);
        expect(map.spawnPoints?.length).toBe(1);
    });

    it('SpaceshipGenerator should have 1 spawn point when requested', () => {
        const gen = new SpaceshipGenerator(seed, width, height);
        const map = gen.generate(1);
        expect(map.spawnPoints?.length).toBe(1);
    });

    it('DenseShipGenerator should have 1 spawn point when requested', () => {
        const gen = new DenseShipGenerator(seed, width, height);
        const map = gen.generate(1);
        expect(map.spawnPoints?.length).toBe(1);
    });
});
