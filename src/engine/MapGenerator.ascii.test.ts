import { describe, it, expect } from 'vitest';
import { MapGenerator } from './MapGenerator';
import { MapDefinition, CellType, Door, Vector2 } from '../shared/types';

describe('MapGenerator.toAscii', () => {
  it('should correctly convert a simple MapDefinition to ASCII', () => {
    const map: MapDefinition = {
      width: 2,
      height: 2,
      cells: [
        { x: 0, y: 0, type: CellType.Floor, walls: { n: true, e: false, s: false, w: true } },
        { x: 1, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: false, w: false } },
        { x: 0, y: 1, type: CellType.Floor, walls: { n: false, e: false, s: true, w: true } },
        { x: 1, y: 1, type: CellType.Floor, walls: { n: false, e: true, s: true, w: false } },
      ],
      doors: [
        {
          id: 'door1',
          segment: [{x:0, y:0}, {x:0, y:1}],
          orientation: 'Horizontal',
          state: 'Closed',
          hp: 10, maxHp: 10, openDuration: 1
        } as Door // Cast to Door
      ],
      spawnPoints: [{ id: 'sp1', pos: { x: 0, y: 0 }, radius: 1 }],
      extraction: { x: 1, y: 1 },
      objectives: [{ id: 'obj1', kind: 'Recover', targetCell: { x: 0, y: 1 } }],
    };

    const expectedAscii =
      '+-+-+' + '\n' +
      '|S  |' + '\n' +
      '+=  +' + '\n' +
      '|O E|' + '\n' +
      '+-+-+';

    const ascii = MapGenerator.toAscii(map);
    expect(ascii).toEqual(expectedAscii);
  });

  it('should handle a map with all walls open', () => {
    const map: MapDefinition = {
      width: 1,
      height: 1,
      cells: [
        { x: 0, y: 0, type: CellType.Floor, walls: { n: false, e: false, s: false, w: false } },
      ],
      spawnPoints: [],
      extraction: undefined,
      objectives: [],
    };
    const expectedAscii =
      '+-+' + '\n' +
      '| |' + '\n' +
      '+-+';
    const ascii = MapGenerator.toAscii(map);
    expect(ascii).toEqual(expectedAscii);
  });

  it('should handle a map with all walls closed', () => {
    const map: MapDefinition = {
      width: 1,
      height: 1,
      cells: [
        { x: 0, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: true } },
      ],
      spawnPoints: [],
      extraction: undefined,
      objectives: [],
    };
    const expectedAscii =
      '+-+' + '\n' +
      '| |' + '\n' +
      '+-+';
    const ascii = MapGenerator.toAscii(map);
    expect(ascii).toEqual(expectedAscii);
  });
});
