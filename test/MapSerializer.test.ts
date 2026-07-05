import { describe, it, expect } from 'vitest';
import { parseMapRaw, indexToChip, serializeMap } from '../src/game/loaders/MapSerializer';
import { chipToIndex } from '../src/game/loaders/MapLoader';

describe('serializeMap / parseMapRaw', () => {
  it('chips を .map バイト列へ直列化し、読み戻すと一致する(往復)', () => {
    const chips = [
      [0, 1, 17],
      [4, 0, 2],
    ];
    const bytes = serializeMap(chips);
    // ROW=2, COL=3(0x00,0x03), 本体 0,1,17,4,0,2
    expect(Array.from(bytes)).toEqual([2, 0x00, 0x03, 0, 1, 17, 4, 0, 2]);
    const raw = parseMapRaw(bytes.buffer);
    expect(raw.height).toBe(2);
    expect(raw.width).toBe(3);
    expect(raw.chips).toEqual(chips);
  });
});

describe('indexToChip', () => {
  it('負のindex(空)は chip 0', () => {
    expect(indexToChip(-1)).toBe(0);
  });
  it('chipToIndex の逆写像になっている', () => {
    expect(indexToChip(1)).toBe(1);
    expect(indexToChip(6)).toBe(17);
    // 逆変換の一貫性
    expect(chipToIndex(indexToChip(6))).toBe(6);
    expect(chipToIndex(indexToChip(1))).toBe(1);
  });
});
