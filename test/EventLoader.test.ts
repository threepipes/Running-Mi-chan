import { describe, it, expect } from 'vitest';
import { parseEvents } from '../src/game/loaders/EventLoader';

describe('parseEvents', () => {
  it('TYPE,x,y の行をパースする', () => {
    const text = 'NEEDLE,321,10\nENEMY,245,11\nSPRING,100,5\nGATE,250,12';
    expect(parseEvents(text)).toEqual([
      { type: 'NEEDLE', tileX: 321, tileY: 10 },
      { type: 'ENEMY', tileX: 245, tileY: 11 },
      { type: 'SPRING', tileX: 100, tileY: 5 },
      { type: 'GATE', tileX: 250, tileY: 12 },
    ]);
  });
  it('空行・未知タイプ・CRLF を無視する', () => {
    const text = 'NEEDLE,1,2\r\n\r\nUNKNOWN,3,4\n';
    expect(parseEvents(text)).toEqual([{ type: 'NEEDLE', tileX: 1, tileY: 2 }]);
  });
});
