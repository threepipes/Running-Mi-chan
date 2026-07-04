import { STAGES } from './stages';

const STORAGE_KEY = 'runaction:progress';

export interface StageProgress {
  cleared: boolean;
  gateless: boolean;
}

function emptyProgress(): StageProgress[] {
  return STAGES.map(() => ({ cleared: false, gateless: false }));
}

export function loadProgress(): StageProgress[] {
  const base = emptyProgress();
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as StageProgress[];
    for (let i = 0; i < base.length; i++) {
      if (parsed[i]) {
        base[i] = { cleared: !!parsed[i].cleared, gateless: !!parsed[i].gateless };
      }
    }
  } catch {
    // localStorage 不可 / 破損時はデフォルトで続行
  }
  return base;
}

export function getStageProgress(index: number): StageProgress {
  return loadProgress()[index] ?? { cleared: false, gateless: false };
}

export function recordClear(index: number, gateless: boolean): void {
  const all = loadProgress();
  if (!all[index]) return;
  all[index] = {
    cleared: true,
    gateless: all[index].gateless || gateless, // 一度でもゲートレス達成なら維持
  };
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // 保存不可でも進行は止めない
  }
}
