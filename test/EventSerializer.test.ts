import { describe, it, expect } from 'vitest';
import { serializeEvents } from '../src/game/loaders/EventSerializer';
import { parseEvents } from '../src/game/loaders/EventLoader';

describe('serializeEvents', () => {
  it('エンティティを CSV へ直列化する', () => {
    const csv = serializeEvents([
      { type: 'ENEMY', tileX: 3, tileY: 4 },
      { type: 'SPRING', tileX: 5, tileY: 6 },
    ]);
    expect(csv).toBe('ENEMY,3,4\nSPRING,5,6\n');
  });

  it('parseEvents と往復一致する', () => {
    const list = [
      { type: 'GATE' as const, tileX: 1, tileY: 2 },
      { type: 'STAR' as const, tileX: 7, tileY: 8 },
    ];
    expect(parseEvents(serializeEvents(list))).toEqual(list);
  });
});
