import { describe, it, expect } from 'vitest';
import { STAGES } from '../src/game/stages';

describe('STAGES', () => {
  it('3ステージを index 0..2 で定義する', () => {
    expect(STAGES).toHaveLength(3);
    expect(STAGES.map((s) => s.index)).toEqual([0, 1, 2]);
  });
  it('mapKey / eventKey は一意', () => {
    const keys = STAGES.flatMap((s) => [s.mapKey, s.eventKey]);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('各ステージが name / mapFile / eventFile を持つ', () => {
    for (const s of STAGES) {
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.mapFile).toMatch(/^levels\/.+\.map$/);
      expect(s.eventFile).toMatch(/^levels\/.+\.evt$/);
    }
  });
});
