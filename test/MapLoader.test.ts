import { describe, it, expect } from 'vitest';
import { chipToIndex, parseMap } from '../src/game/loaders/MapLoader';

describe('chipToIndex', () => {
  it('chip 0 は空(-1)', () => {
    expect(chipToIndex(0)).toBe(-1);
  });
  it('同一行(0-4)はそのまま', () => {
    expect(chipToIndex(1)).toBe(1);
    expect(chipToIndex(2)).toBe(2);
    expect(chipToIndex(4)).toBe(4);
  });
  it('chip 17 は 2行目の 5*1+1=6', () => {
    expect(chipToIndex(17)).toBe(6);
  });
});

describe('parseMap', () => {
  it('ヘッダ(row=2, col=3)と本体を number[][] に変換する', () => {
    // row=2, col=3(big-endian: 0x00 0x03), 本体: 0,1,17, 4,0,2
    const bytes = new Uint8Array([2, 0x00, 0x03, 0, 1, 17, 4, 0, 2]);
    const parsed = parseMap(bytes.buffer);
    expect(parsed.height).toBe(2);
    expect(parsed.width).toBe(3);
    expect(parsed.data).toEqual([
      [-1, 1, 6],
      [4, -1, 2],
    ]);
  });
});
