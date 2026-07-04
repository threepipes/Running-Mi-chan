export type EntityType = 'ENEMY' | 'NEEDLE' | 'SPRING' | 'GATE' | 'STAR';

export interface EntitySpec {
  type: EntityType;
  tileX: number;
  tileY: number;
}

const VALID: EntityType[] = ['ENEMY', 'NEEDLE', 'SPRING', 'GATE', 'STAR'];

/** .evt CSV(TYPE,tileX,tileY)をパースする。空行・未知タイプは無視 */
export function parseEvents(text: string): EntitySpec[] {
  const specs: EntitySpec[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const [type, x, y] = t.split(',');
    if (!VALID.includes(type as EntityType)) continue;
    specs.push({ type: type as EntityType, tileX: parseInt(x, 10), tileY: parseInt(y, 10) });
  }
  return specs;
}
