import { describe, it, expect, beforeEach } from 'vitest';
import { loadProgress, recordClear, getStageProgress } from '../src/game/Progress';

// node 環境には localStorage が無いのでメモリ実装を注入する
function installMockStorage(): void {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

describe('Progress', () => {
  beforeEach(() => {
    installMockStorage();
  });

  it('未保存時は全ステージ未クリア', () => {
    const p = loadProgress();
    expect(p).toHaveLength(3);
    expect(p.every((s) => !s.cleared && !s.gateless)).toBe(true);
  });

  it('recordClear でクリア状態が保存される', () => {
    recordClear(1, false);
    expect(getStageProgress(1)).toEqual({ cleared: true, gateless: false });
    expect(getStageProgress(0).cleared).toBe(false);
  });

  it('一度ゲートレス達成したら以後 gateless を維持する', () => {
    recordClear(2, true);
    recordClear(2, false); // ゲート使用クリアでも
    expect(getStageProgress(2)).toEqual({ cleared: true, gateless: true });
  });

  it('localStorage が使えなくても例外を投げない', () => {
    (globalThis as unknown as { localStorage: undefined }).localStorage = undefined;
    expect(() => recordClear(0, true)).not.toThrow();
    expect(loadProgress().every((s) => !s.cleared)).toBe(true);
  });
});
