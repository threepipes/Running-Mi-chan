import { describe, it, expect } from 'vitest';
import { xorBytes } from '../src/game/audio/descramble';

describe('xorBytes', () => {
  it('同じ鍵で2回かけると元に戻る(対称)', () => {
    const data = new Uint8Array([0, 1, 2, 250, 255, 128]);
    const key = 'abc';
    const scrambled = xorBytes(data, key);
    // 少なくとも一部は変化している
    expect(Array.from(scrambled)).not.toEqual(Array.from(data));
    const restored = xorBytes(scrambled, key);
    expect(Array.from(restored)).toEqual(Array.from(data));
  });

  it('既知ベクトル: 鍵1文字XOR', () => {
    const data = new Uint8Array([0x00, 0xff, 0x41]);
    // 'A' = 0x41 の繰り返しXOR
    const out = xorBytes(data, 'A');
    expect(Array.from(out)).toEqual([0x41, 0xbe, 0x00]);
  });

  it('空キーは例外(スクランブルされない素通しを防ぐ)', () => {
    expect(() => xorBytes(new Uint8Array([1, 2, 3]), '')).toThrow(/must not be empty/);
  });
});
